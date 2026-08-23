import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';
import { getApiRoutePolicy } from '@/lib/api/route-policy';
import { ACTIVE_TENANT_COOKIE_NAME } from '@/lib/auth';

const PUBLIC_PAGES = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/auth/confirm',
  '/auth/error',
]);

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PAGES.has(pathname);
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { response, claims, client } = await updateSession(request);
  const isApi = request.nextUrl.pathname.startsWith('/api/');

  if (isApi) {
    const policy = getApiRoutePolicy(request.nextUrl.pathname, request.method);
    if (!policy || (policy.access === 'development' && process.env.NODE_ENV !== 'development')) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '资源不存在', requestId: crypto.randomUUID() } },
        { status: 404, headers: response.headers },
      );
    }
    if (policy.access === 'public') {
      return response;
    }
    if (!claims?.sub) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: '未登录或登录已失效', requestId: crypto.randomUUID() } },
        { status: 401, headers: response.headers },
      );
    }
    if (policy.access === 'enterprise') {
      const enterpriseId = request.cookies.get(ACTIVE_TENANT_COOKIE_NAME)?.value;
      if (!enterpriseId) {
        return NextResponse.json(
          { error: { code: 'ENTERPRISE_SELECTION_REQUIRED', message: '请选择要进入的企业', requestId: crypto.randomUUID() } },
          { status: 409, headers: response.headers },
        );
      }
      const { data, error } = await client.rpc('current_enterprise_grants', {
        target_tenant_id: enterpriseId,
      });
      const allowed = !error && policy.permission && data?.some(
        (grant) => grant.permission === policy.permission,
      );
      if (!allowed) {
        return NextResponse.json(
          { error: { code: 'ENTERPRISE_PERMISSION_DENIED', message: '没有执行该操作的权限', requestId: crypto.randomUUID() } },
          { status: 403, headers: response.headers },
        );
      }
    }
    return response;
  }

  if (claims?.sub || isPublicPath(request.nextUrl.pathname)) {
    return response;
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl, { headers: response.headers });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.[^/]+$).*)'],
};
