/**
 * Supabase environment validation and legacy client compatibility.
 *
 * New request code must use the factories in `@/lib/supabase`. This module
 * deliberately does not expose a Secret Key client.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const LOCAL_HOST_PATTERNS: RegExp[] = [
  /^https?:\/\/localhost\b/i,
  /^https?:\/\/127\.0\.0\.1\b/i,
  /^https?:\/\/\[\s*::1\s*\]/i,
  /\.local\b/i,
];

interface SupabasePublicCredentials {
  url: string;
  publishableKey: string;
}

interface SupabaseCredentials extends SupabasePublicCredentials {
  secretKey?: string;
}

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not set. Please configure your Supabase environment.`);
  }
  return value;
}

function getSupabasePublicCredentials(): SupabasePublicCredentials {
  const url = requireEnvironmentVariable('NEXT_PUBLIC_SUPABASE_URL');
  const publishableKey = requireEnvironmentVariable(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  );

  if (LOCAL_HOST_PATTERNS.some((pattern) => pattern.test(url))) {
    throw new Error(
      `Local Supabase URL is not supported: "${url}". This project requires a cloud Supabase instance.`,
    );
  }

  return { url, publishableKey };
}

/** @deprecated Prefer the purpose-specific Supabase factories. */
function getSupabaseCredentials(): SupabaseCredentials {
  return {
    ...getSupabasePublicCredentials(),
    secretKey: process.env.SUPABASE_SECRET_KEY?.trim() || undefined,
  };
}

/**
 * @deprecated Request code should use `@/lib/supabase/server`; browser code
 * should use `@/lib/supabase/browser`. Kept while legacy call sites migrate.
 */
function getSupabaseClient(token?: string): SupabaseClient {
  const { url, publishableKey } = getSupabasePublicCredentials();

  return createClient(url, publishableKey, {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
    db: { timeout: 60_000 },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export {
  getSupabaseClient,
  getSupabaseCredentials,
  getSupabasePublicCredentials,
  requireEnvironmentVariable,
};
export type { SupabaseCredentials, SupabasePublicCredentials };
