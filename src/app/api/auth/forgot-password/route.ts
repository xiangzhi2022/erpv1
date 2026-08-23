import { parseJsonObject } from '@/lib/api/request';
import { NextRequest, NextResponse } from 'next/server';
import { forgotPasswordSchema } from '@/lib/auth/schemas';
import { createAuthService, getApplicationUrl } from '@/lib/auth/service';
import { authRouteError, authValidationError } from '@/lib/auth/route-response';
import { enforceRateLimit } from '@/lib/security/rate-limit';

const GENERIC_MESSAGE = '如果该邮箱已注册，密码重置邮件已发送';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const parsed = forgotPasswordSchema.safeParse(await parseJsonObject(request));
    if (!parsed.success) {
      return authValidationError(parsed.error.issues[0]?.message || '邮箱格式不正确');
    }
    await enforceRateLimit({
      bucket: 'auth.forgot-password.account',
      identifier: parsed.data.email.toLowerCase(),
      limit: 5,
      windowSeconds: 3600,
    });
    await (await createAuthService()).requestPasswordReset(parsed.data.email, getApplicationUrl());
    return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
  } catch (error) {
    return authRouteError(error, request);
  }
}
