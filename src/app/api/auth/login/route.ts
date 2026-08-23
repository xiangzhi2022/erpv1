import { parseJsonObject } from '@/lib/api/request';
import { NextRequest, NextResponse } from 'next/server';
import { loginSchema } from '@/lib/auth/schemas';
import { createAuthService } from '@/lib/auth/service';
import { authRouteError, authValidationError } from '@/lib/auth/route-response';
import { enforceRateLimit, requireTrustedClientIp } from '@/lib/security/rate-limit';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const clientIp = requireTrustedClientIp(request);
    await enforceRateLimit({
      bucket: 'auth.login.ip',
      identifier: clientIp,
      limit: 10,
      windowSeconds: 900,
    });
    const parsed = loginSchema.safeParse(await parseJsonObject(request));
    if (!parsed.success) {
      return authValidationError(parsed.error.issues[0]?.message || '登录参数不正确');
    }

    await enforceRateLimit({
      bucket: 'auth.login.account',
      identifier: parsed.data.account,
      identifierKind: 'account',
      limit: 10,
      windowSeconds: 900,
    });
    const { user, requiresOnboarding } = await (await createAuthService()).signInWithPassword(parsed.data);
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
      },
      redirectTo: requiresOnboarding ? '/onboarding' : '/orders',
    });
  } catch (error) {
    return authRouteError(error, request);
  }
}
