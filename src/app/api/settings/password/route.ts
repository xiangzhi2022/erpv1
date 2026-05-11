import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { hashPassword, isPlaintextPassword, verifyPassword } from '@/lib/auth';
import { passwordSchema } from '@/app/settings/schemas';
import { authFailed, requireSettingsUser } from '../_utils';

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;

    const parsed = passwordSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || '??????' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('password')
      .eq('id', auth.user.id)
      .maybeSingle();

    if (fetchError || !userData?.password) {
      return NextResponse.json({ success: false, error: '?????' }, { status: 404 });
    }

    const { currentPassword, newPassword } = parsed.data;
    const passwordMatches = isPlaintextPassword(userData.password)
      ? userData.password === currentPassword
      : verifyPassword(currentPassword, userData.password);

    if (!passwordMatches) {
      return NextResponse.json({ success: false, error: '???????' }, { status: 400 });
    }

    const { error } = await supabase
      .from('users')
      .update({ password: hashPassword(newPassword), updated_at: new Date().toISOString() })
      .eq('id', auth.user.id);

    if (error) {
      return NextResponse.json({ success: false, error: '??????' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '??????' });
  } catch (error) {
    console.error('update password failed:', error);
    return NextResponse.json({ success: false, error: '??????' }, { status: 500 });
  }
}
