import { parseJsonObject } from '@/lib/api/request';
import { NextRequest, NextResponse } from 'next/server';
import { resetPasswordSchema } from '@/lib/auth/schemas';
import { createAuthService } from '@/lib/auth/service';
import { authRouteError, authValidationError } from '@/lib/auth/route-response';
import { ApiError } from '@/lib/api/errors';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { createClient } from '@/lib/supabase/server';
import {
  RECOVERY_PROOF_COOKIE,
  recoveryProofCookieOptions,
  verifyRecoveryProof,
} from '@/lib/auth/recovery-proof';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const parsed = resetPasswordSchema.safeParse(await parseJsonObject(request));
    if (!parsed.success) {
      return authValidationError(parsed.error.issues[0]?.message || '密码参数不正确');
    }
    const client = await createClient();
    const { data: claimsData, error: claimsError } = await client.auth.getClaims();
    const claims = claimsError ? null : claimsData?.claims;
    const recoveryUserId = claims && typeof claims.sub === 'string' ? claims.sub : null;
    const proof = recoveryUserId
      ? verifyRecoveryProof(request.cookies.get(RECOVERY_PROOF_COOKIE)?.value, recoveryUserId)
      : null;
    if (!recoveryUserId || !proof) {
      throw ApiError.unauthorized('RECOVERY_SESSION_REQUIRED', '请先完成密码恢复验证');
    }
    await enforceRateLimit({
      bucket: 'auth.reset-password.user',
      identifier: recoveryUserId,
      limit: 5,
      windowSeconds: 3600,
    });
    const { data: consumed, error: consumeError } = await client.rpc('consume_recovery_proof', {
      target_nonce_hash: proof.nonceHash,
    });
    if (consumeError || consumed !== true) {
      throw ApiError.unauthorized('RECOVERY_SESSION_REQUIRED', '请先完成密码恢复验证');
    }
    await (await createAuthService()).updatePassword(parsed.data.password);
    const response = NextResponse.json({ success: true, message: '密码已更新' });
    response.cookies.set(RECOVERY_PROOF_COOKIE, '', { ...recoveryProofCookieOptions, maxAge: 0 });
    return response;
  } catch (error) {
    return authRouteError(error, request);
  }
}
