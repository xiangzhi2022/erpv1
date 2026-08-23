import { parseJsonObject } from '@/lib/api/request';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAuthService } from '@/lib/auth/service';
import { authRouteError, authValidationError } from '@/lib/auth/route-response';
import { enforceRateLimit } from '@/lib/security/rate-limit';

const schema = z.object({ phone: z.string().trim().regex(/^1[3-9]\d{9}$/, '手机号格式不正确') });

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const parsed = schema.safeParse(await parseJsonObject(request));
    if (!parsed.success) return authValidationError(parsed.error.issues[0]?.message || '手机号格式不正确');
    await enforceRateLimit({
      bucket: 'auth.sms.send.destination',
      identifier: parsed.data.phone,
      limit: 5,
      windowSeconds: 3600,
    });
    await (await createAuthService()).sendPhoneOtp(parsed.data.phone);
    return NextResponse.json({ success: true, message: '验证码已发送' });
  } catch (error) {
    return authRouteError(error, request);
  }
}
