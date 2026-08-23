import { NextRequest, NextResponse } from 'next/server';
import { emailOtpSchema } from '@/lib/auth/schemas';
import { createAuthService } from '@/lib/auth/service';
import { authRouteError, authValidationError } from '@/lib/auth/route-response';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = emailOtpSchema.safeParse({ email: body.email, token: body.token || body.code });
    if (!parsed.success) return authValidationError(parsed.error.issues[0]?.message || '验证参数不正确');
    await (await createAuthService()).verifyEmailOtp(parsed.data.email, parsed.data.token);
    return NextResponse.json({ success: true, message: '验证成功' });
  } catch (error) {
    return authRouteError(error);
  }
}
