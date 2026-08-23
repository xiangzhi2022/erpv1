import { parseJsonObject } from '@/lib/api/request';
import { NextRequest, NextResponse } from 'next/server';
import { onboardingSchema } from '@/lib/auth/schemas';
import { createAuthService } from '@/lib/auth/service';
import { authRouteError, authValidationError } from '@/lib/auth/route-response';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const parsed = onboardingSchema.safeParse(await parseJsonObject(request));
    if (!parsed.success) {
      return authValidationError(parsed.error.issues[0]?.message || '企业信息不正确');
    }
    const enterpriseId = await (await createAuthService())
      .completeEnterpriseOnboarding(parsed.data);
    return NextResponse.json({ success: true, enterpriseId }, { status: 201 });
  } catch (error) {
    return authRouteError(error);
  }
}
