import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';
import { getApiRoutePolicy } from '@/lib/api/route-policy';
import { ACTIVE_TENANT_COOKIE_NAME } from '@/lib/auth';
import { getSupabasePublicCredentials } from '@/db/client';

const PUBLIC_PAGES = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/auth/confirm',
  '/auth/error',
  '/401',
]);

const CONTENT_SECURITY_POLICY_HEADER = 'Content-Security-Policy';
const NONCE_HEADER = 'x-nonce';
const REQUEST_ID_HEADER = 'x-request-id';

interface RequestSecurityContext {
  contentSecurityPolicy: string;
  nonce: string;
  requestId: string;
}

function createRequestSecurityContext(): RequestSecurityContext {
  const nonce = btoa(crypto.randomUUID());
  const requestId = crypto.randomUUID();
  const { url } = getSupabasePublicCredentials();
  const supabaseOrigin = new URL(url).origin;
  const realtimeUrl = new URL(supabaseOrigin);
  realtimeUrl.protocol = realtimeUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  const developmentScriptPolicy = process.env.NODE_ENV === 'development'
    ? " 'unsafe-eval'"
    : '';
  const contentSecurityPolicy = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${developmentScriptPolicy};
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob: ${supabaseOrigin};
    font-src 'self' data:;
    connect-src 'self' ${supabaseOrigin} ${realtimeUrl.origin};
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
  `.replace(/\s{2,}/g, ' ').trim();

  return { contentSecurityPolicy, nonce, requestId };
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PAGES.has(pathname);
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const security = createRequestSecurityContext();
  request.headers.set(CONTENT_SECURITY_POLICY_HEADER, security.contentSecurityPolicy);
  request.headers.set(NONCE_HEADER, security.nonce);
  request.headers.set(REQUEST_ID_HEADER, security.requestId);

  const { response, claims, client } = await updateSession(request);
  response.headers.set(CONTENT_SECURITY_POLICY_HEADER, security.contentSecurityPolicy);
  response.headers.set(REQUEST_ID_HEADER, security.requestId);
  const isApi = request.nextUrl.pathname.startsWith('/api/');

  if (isApi) {
    const policy = getApiRoutePolicy(request.nextUrl.pathname, request.method);
    if (!policy || (policy.access === 'development' && process.env.NODE_ENV !== 'development')) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: '资源不存在', requestId: security.requestId } },
        { status: 404, headers: response.headers },
      );
    }
    if (policy.access === 'public') {
      return response;
    }
    if (!claims?.sub) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: '未登录或登录已失效', requestId: security.requestId } },
        { status: 401, headers: response.headers },
      );
    }
    if (policy.access === 'enterprise') {
      const enterpriseId = request.cookies.get(ACTIVE_TENANT_COOKIE_NAME)?.value;
      if (!enterpriseId) {
        return NextResponse.json(
          { error: { code: 'ENTERPRISE_SELECTION_REQUIRED', message: '请选择要进入的企业', requestId: security.requestId } },
          { status: 409, headers: response.headers },
        );
      }
      const { data, error } = await client.rpc('current_enterprise_grants', {
        target_tenant_id: enterpriseId,
      });
      const requiredPermissions = policy.permissions
        ?? (policy.permission ? [policy.permission] : []);
      const allowed = !error && requiredPermissions.length > 0 && data?.some(
        (grant) => requiredPermissions.includes(grant.permission as typeof requiredPermissions[number]),
      );
      if (!allowed) {
        return NextResponse.json(
          { error: { code: 'ENTERPRISE_PERMISSION_DENIED', message: '没有执行该操作的权限', requestId: security.requestId } },
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
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$|file\\.svg$|globe\\.svg$|next\\.svg$|vercel\\.svg$|window\\.svg$).*)',
  ],
};
