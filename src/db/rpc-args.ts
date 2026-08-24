import type { Database } from '@/db/database.types';

type PublicFunctionName = keyof Database['public']['Functions'];
type PublicFunctionArgs<TName extends PublicFunctionName> =
  Database['public']['Functions'][TName]['Args'];

/**
 * Supabase's generated function argument types do not represent PostgreSQL's
 * ability to accept NULL. Keep that exception explicit per RPC and per key so
 * callers can preserve intentional clear/no-scope semantics without weakening
 * every generated argument type.
 */
export function allowNullableRpcArgs<
  TName extends PublicFunctionName,
  TNullableKey extends keyof PublicFunctionArgs<TName>,
>(
  args: Omit<PublicFunctionArgs<TName>, TNullableKey> & {
    [TKey in TNullableKey]: PublicFunctionArgs<TName>[TKey] | null;
  },
): PublicFunctionArgs<TName> {
  return args as PublicFunctionArgs<TName>;
}
