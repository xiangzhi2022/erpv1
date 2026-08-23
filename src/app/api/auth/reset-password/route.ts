import { parseJsonObject } from '@/lib/api/request';
import { NextRequest, NextResponse } from 'next/server';
import { resetPasswordSchema } from '@/lib/auth/schemas';
import { createAuthService } from '@/lib/auth/service';
import { authRouteError, authValidationError } from '@/lib/auth/route-response';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const parsed = resetPasswordSchema.safeParse(await parseJsonObject(request));
    if (!parsed.success) {
      return authValidationError(parsed.error.issues[0]?.message || '密码参数不正确');
    }
    await (await createAuthService()).updatePassword(parsed.data.password);
    return NextResponse.json({ success: true, message: '密码已更新' });
  } catch (error) {
    return authRouteError(error);
  }
}
