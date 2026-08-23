import { NextRequest, NextResponse } from 'next/server';
import { createAuthService, safeRedirectPath } from '@/lib/auth/service';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.redirect(new URL('/auth/error?code=missing_confirmation_code', request.url));
  }

  try {
    await (await createAuthService()).exchangeCodeForSession(code);
    const next = safeRedirectPath(request.nextUrl.searchParams.get('next'));
    return NextResponse.redirect(new URL(next, request.url));
  } catch {
    return NextResponse.redirect(new URL('/auth/error?code=confirmation_failed', request.url));
  }
}
