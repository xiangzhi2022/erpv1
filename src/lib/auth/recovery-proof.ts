import 'server-only';

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const RECOVERY_PROOF_COOKIE = 'erp_recovery_proof';
export const RECOVERY_PROOF_TTL_SECONDS = 10 * 60;

interface RecoveryProofPayload {
  exp: number;
  nonce: string;
  uid: string;
  v: 1;
}

interface RecoveryFlowPayload {
  emailHash: string;
  exp: number;
  nonce: string;
  v: 1;
}

function signingKey(): Buffer {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error('Recovery proof signing is not configured');
  return createHmac('sha256', secret).update('erpv1/recovery-proof/v1').digest();
}

function signature(encodedPayload: string): Buffer {
  return createHmac('sha256', signingKey()).update(encodedPayload).digest();
}

function nonceHash(nonce: string): string {
  return createHash('sha256').update(nonce).digest('hex');
}

function canonicalEmail(email: string): string {
  return email.trim().toLowerCase();
}

function emailHash(email: string): string {
  return createHmac('sha256', signingKey())
    .update(`email:${canonicalEmail(email)}`)
    .digest('hex');
}

export function issueRecoveryFlow(email: string, now = Date.now()): {
  emailHash: string;
  expiresAt: string;
  nonceHash: string;
  token: string;
} {
  const nonce = randomBytes(32).toString('base64url');
  const exp = Math.floor(now / 1000) + RECOVERY_PROOF_TTL_SECONDS;
  const hashedEmail = emailHash(email);
  const payload: RecoveryFlowPayload = { emailHash: hashedEmail, exp, nonce, v: 1 };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return {
    emailHash: hashedEmail,
    expiresAt: new Date(exp * 1000).toISOString(),
    nonceHash: nonceHash(nonce),
    token: `${encodedPayload}.${signature(`flow:${encodedPayload}`).toString('base64url')}`,
  };
}

export function verifyRecoveryFlow(
  token: string | undefined,
  verifiedEmail: string,
  now = Date.now(),
): { emailHash: string; nonceHash: string } | null {
  if (!token || token.length > 2048) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, encodedSignature] = parts;
  try {
    const provided = Buffer.from(encodedSignature, 'base64url');
    const expected = signature(`flow:${encodedPayload}`);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
    const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<RecoveryFlowPayload>;
    if (
      parsed.v !== 1
      || parsed.emailHash !== emailHash(verifiedEmail)
      || typeof parsed.exp !== 'number'
      || parsed.exp <= Math.floor(now / 1000)
      || typeof parsed.nonce !== 'string'
      || !/^[A-Za-z0-9_-]{40,64}$/.test(parsed.nonce)
    ) return null;
    return { emailHash: parsed.emailHash, nonceHash: nonceHash(parsed.nonce) };
  } catch {
    return null;
  }
}

export function issueRecoveryProof(userId: string, now = Date.now()): {
  expiresAt: string;
  nonceHash: string;
  token: string;
} {
  const nonce = randomBytes(32).toString('base64url');
  const exp = Math.floor(now / 1000) + RECOVERY_PROOF_TTL_SECONDS;
  const payload: RecoveryProofPayload = { exp, nonce, uid: userId, v: 1 };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const encodedSignature = signature(encodedPayload).toString('base64url');
  return {
    expiresAt: new Date(exp * 1000).toISOString(),
    nonceHash: nonceHash(nonce),
    token: `${encodedPayload}.${encodedSignature}`,
  };
}

export function verifyRecoveryProof(
  token: string | undefined,
  expectedUserId: string,
  now = Date.now(),
): { nonceHash: string } | null {
  if (!token || token.length > 2048) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, encodedSignature] = parts;
  try {
    const provided = Buffer.from(encodedSignature, 'base64url');
    const expected = signature(encodedPayload);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
    const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as Partial<RecoveryProofPayload>;
    if (
      parsed.v !== 1
      || parsed.uid !== expectedUserId
      || typeof parsed.exp !== 'number'
      || parsed.exp <= Math.floor(now / 1000)
      || typeof parsed.nonce !== 'string'
      || !/^[A-Za-z0-9_-]{40,64}$/.test(parsed.nonce)
    ) return null;
    return { nonceHash: nonceHash(parsed.nonce) };
  } catch {
    return null;
  }
}

export const recoveryProofCookieOptions = {
  httpOnly: true,
  maxAge: RECOVERY_PROOF_TTL_SECONDS,
  path: '/api/auth/reset-password',
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
};
