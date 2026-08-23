import { NextRequest, NextResponse } from 'next/server';
import { createAuthService, safeRedirectPath } from '@/lib/auth/service';
import {
  issueRecoveryProof,
  RECOVERY_PROOF_COOKIE,
  recoveryProofCookieOptions,
  verifyRecoveryFlow,
} from '@/lib/auth/recovery-proof';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) {
    return NextResponse.redirect(new URL('/auth/error?code=missing_confirmation_code', request.url));
  }

  try {
    const exchange = await (await createAuthService()).exchangeCodeForSession(code);
    const next = safeRedirectPath(request.nextUrl.searchParams.get('next'));
    const response = NextResponse.redirect(new URL(next, request.url));
    if (request.nextUrl.searchParams.get('type') === 'recovery' && next === '/reset-password') {
      const flow = verifyRecoveryFlow(request.nextUrl.searchParams.get('flow') ?? undefined, exchange.email);
      if (!flow) throw new Error('Invalid recovery flow');
      const { data: consumed, error: consumeError } = await createAdminClient().rpc('consume_recovery_flow', {
        target_email_hash: flow.emailHash,
        target_nonce_hash: flow.nonceHash,
      });
      if (consumeError || consumed !== true) throw new Error('Invalid recovery flow');
      const proof = issueRecoveryProof(exchange.userId);
      const client = await createClient();
      const { error } = await client.rpc('register_recovery_proof', {
        target_expires_at: proof.expiresAt,
        target_nonce_hash: proof.nonceHash,
      });
      if (error) throw new Error('Unable to register recovery proof');
      response.cookies.set(RECOVERY_PROOF_COOKIE, proof.token, recoveryProofCookieOptions);
    }
    return response;
  } catch {
    return NextResponse.redirect(new URL('/auth/error?code=confirmation_failed', request.url));
  }
}
