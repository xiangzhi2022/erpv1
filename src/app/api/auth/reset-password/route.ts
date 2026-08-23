import { parseJsonObject } from '@/lib/api/request';
import { NextRequest, NextResponse } from 'next/server';
import { resetPasswordSchema } from '@/lib/auth/schemas';
import { createAuthService } from '@/lib/auth/service';
import { authRouteError, authValidationError } from '@/lib/auth/route-response';
import { ApiError } from '@/lib/api/errors';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const parsed = resetPasswordSchema.safeParse(await parseJsonObject(request));
    if (!parsed.success) {
      return authValidationError(parsed.error.issues[0]?.message || '密码参数不正确');
    }
    const client = await createClient();
    const { data: claimsData, error: claimsError } = await client.auth.getClaims();
    const recoveryUserId = claimsError ? null : claimsData?.claims?.sub;
    if (!recoveryUserId) {
      throw ApiError.unauthorized('RECOVERY_SESSION_REQUIRED', '请先完成密码恢复验证');
    }
    await enforceRateLimit({
      bucket: 'auth.reset-password.user',
      identifier: recoveryUserId,
      limit: 5,
      windowSeconds: 3600,
    });
    await (await createAuthService()).updatePassword(parsed.data.password);
    return NextResponse.json({ success: true, message: '密码已更新' });
  } catch (error) {
    return authRouteError(error, request);
  }
}
