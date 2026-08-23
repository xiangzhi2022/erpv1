import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

const PUBLIC_PAGES = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/auth/confirm',
  '/auth/error',
]);

const PUBLIC_AUTH_API_PATHS = new Set([
  '/api/auth/email/send',
  '/api/auth/email/verify',
  '/api/auth/forgot-password',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/reset-password',
  '/api/auth/sms/send',
  '/api/auth/sms/verify',
]);

function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PAGES.has(pathname) ||
    PUBLIC_AUTH_API_PATHS.has(pathname) ||
    pathname.startsWith('/api/auth/oauth/')
  );
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { response, claims } = await updateSession(request);

  if (claims?.sub || isPublicPath(request.nextUrl.pathname)) {
    return response;
  }

  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: '未登录或登录已失效',
        },
      },
      { status: 401, headers: response.headers },
    );
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl, { headers: response.headers });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.[^/]+$).*)'],
};
