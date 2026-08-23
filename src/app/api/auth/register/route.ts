import { parseJsonObject } from '@/lib/api/request';
import { NextRequest, NextResponse } from 'next/server';
import { registerSchema } from '@/lib/auth/schemas';
import { createAuthService } from '@/lib/auth/service';
import { authRouteError, authValidationError } from '@/lib/auth/route-response';

const ENTERPRISE_TYPE_ALIASES: Record<string, 'manufacturer' | 'dealer' | 'supplier'> = {
  manufacturer: 'manufacturer',
  dealer: 'dealer',
  material_supplier: 'supplier',
  supplier: 'supplier',
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await parseJsonObject(request)) as Record<string, unknown>;
    const rawType = typeof body.enterpriseType === 'string'
      ? body.enterpriseType
      : typeof body.tenantType === 'string'
        ? body.tenantType
        : '';
    const parsed = registerSchema.safeParse({
      account: body.account || body.email || body.phone,
      password: body.password,
      displayName: body.displayName || body.contactPerson || body.nickname,
      enterpriseName: body.enterpriseName || body.companyName,
      enterpriseType: ENTERPRISE_TYPE_ALIASES[rawType],
    });
    if (!parsed.success) {
      return authValidationError(parsed.error.issues[0]?.message || '注册参数不正确');
    }

    const result = await (await createAuthService()).signUp(parsed.data);
    return NextResponse.json(
      {
        success: true,
        requiresVerification: result.requiresVerification,
        enterpriseId: result.enterpriseId,
        message: result.requiresVerification
          ? '验证信息已发送，请完成身份验证'
          : '注册成功',
      },
      { status: result.requiresVerification ? 202 : 201 },
    );
  } catch (error) {
    return authRouteError(error);
  }
}
