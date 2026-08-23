import { parseJsonObject } from '@/lib/api/request';
import { NextRequest, NextResponse } from 'next/server';
import { phoneOtpSchema } from '@/lib/auth/schemas';
import { createAuthService } from '@/lib/auth/service';
import { authRouteError, authValidationError } from '@/lib/auth/route-response';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await parseJsonObject(request)) as Record<string, unknown>;
    const parsed = phoneOtpSchema.safeParse({ phone: body.phone, token: body.token || body.code });
    if (!parsed.success) return authValidationError(parsed.error.issues[0]?.message || '验证参数不正确');
    await (await createAuthService()).verifyPhoneOtp(parsed.data.phone, parsed.data.token);
    return NextResponse.json({ success: true, message: '验证成功' });
  } catch (error) {
    return authRouteError(error);
  }
}
