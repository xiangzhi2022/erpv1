import { NextRequest, NextResponse } from 'next/server';
import { createAuthService, getApplicationUrl } from '@/lib/auth/service';
import { authRouteError } from '@/lib/auth/route-response';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  try {
    const { provider } = await params;
    const redirect = request.nextUrl.searchParams.get('redirect');
    const url = await (await createAuthService()).signInWithOAuth(
      provider,
      redirect,
      getApplicationUrl(),
    );
    return NextResponse.redirect(url);
  } catch (error) {
    return authRouteError(error);
  }
}
