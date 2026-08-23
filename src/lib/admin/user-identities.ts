import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

interface CreateManagedIdentityInput {
  phone: string;
  password: string;
  displayName: string;
}

export async function createManagedIdentity(input: CreateManagedIdentityInput) {
  return createAdminClient().auth.admin.createUser({
    phone: input.phone,
    password: input.password,
    phone_confirm: true,
    user_metadata: { display_name: input.displayName },
  });
}

export async function findManagedIdentityByPhone(phone: string) {
  const { data, error } = await createAdminClient().auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) return { identity: null, error };
  return {
    identity: data.users.find((candidate) => candidate.phone === phone) ?? null,
    error: null,
  };
}

export async function deleteManagedIdentity(userId: string) {
  return createAdminClient().auth.admin.deleteUser(userId);
}
