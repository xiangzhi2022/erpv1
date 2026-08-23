import { parseJsonObject } from '@/lib/api/request';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAuthService } from '@/lib/auth/service';
import { authRouteError, authValidationError } from '@/lib/auth/route-response';
import { enforceRateLimit } from '@/lib/security/rate-limit';

const schema = z.object({ email: z.string().trim().email('邮箱格式不正确') });

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const parsed = schema.safeParse(await parseJsonObject(request));
    if (!parsed.success) return authValidationError(parsed.error.issues[0]?.message || '邮箱格式不正确');
    await enforceRateLimit({
      bucket: 'auth.email.send.destination',
      identifier: parsed.data.email.toLowerCase(),
      limit: 5,
      windowSeconds: 3600,
    });
    await (await createAuthService()).sendEmailVerification(parsed.data.email);
    return NextResponse.json({ success: true, message: '验证信息已发送' });
  } catch (error) {
    return authRouteError(error, request);
  }
}
