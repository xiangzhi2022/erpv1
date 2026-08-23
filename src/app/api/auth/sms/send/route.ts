import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAuthService } from '@/lib/auth/service';
import { authRouteError, authValidationError } from '@/lib/auth/route-response';

const schema = z.object({ phone: z.string().trim().regex(/^1[3-9]\d{9}$/, '手机号格式不正确') });

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return authValidationError(parsed.error.issues[0]?.message || '手机号格式不正确');
    await (await createAuthService()).sendPhoneOtp(parsed.data.phone);
    return NextResponse.json({ success: true, message: '验证码已发送' });
  } catch (error) {
    return authRouteError(error);
  }
}
