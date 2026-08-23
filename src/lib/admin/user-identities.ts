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

export async function updateManagedIdentityPassword(userId: string, password: string) {
  return createAdminClient().auth.admin.updateUserById(userId, { password });
}

export async function deleteManagedIdentity(userId: string) {
  return createAdminClient().auth.admin.deleteUser(userId);
}
