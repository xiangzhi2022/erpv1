import { NextRequest, NextResponse } from 'next/server';
import { loginSchema } from '@/lib/auth/schemas';
import { createAuthService } from '@/lib/auth/service';
import { authRouteError, authValidationError } from '@/lib/auth/route-response';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) {
      return authValidationError(parsed.error.issues[0]?.message || '登录参数不正确');
    }

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
    return authRouteError(error);
  }
}
