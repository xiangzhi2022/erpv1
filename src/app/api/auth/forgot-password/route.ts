import { NextRequest, NextResponse } from 'next/server';
import { forgotPasswordSchema } from '@/lib/auth/schemas';
import { createAuthService, getApplicationUrl } from '@/lib/auth/service';
import { authRouteError, authValidationError } from '@/lib/auth/route-response';

const GENERIC_MESSAGE = '如果该邮箱已注册，密码重置邮件已发送';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const parsed = forgotPasswordSchema.safeParse(await request.json());
    if (!parsed.success) {
      return authValidationError(parsed.error.issues[0]?.message || '邮箱格式不正确');
    }
    await (await createAuthService()).requestPasswordReset(parsed.data.email, getApplicationUrl());
    return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
  } catch (error) {
    return authRouteError(error);
  }
}
