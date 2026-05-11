import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { profileSchema } from '@/app/settings/schemas';
import { authFailed, loadUserSettings, normalizeTenant, requireSettingsUser } from '../_utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;

    const supabase = getSupabaseClient();
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, phone, real_name, role, tenant_id, is_active, department, created_at')
      .eq('id', auth.user.id)
      .maybeSingle();

    if (userError) {
      return NextResponse.json({ success: false, error: '????????' }, { status: 500 });
    }

    let tenant = null;
    if (userData?.tenant_id) {
      const { data } = await supabase
        .from('tenants')
        .select('id, name, company_name, tenant_type, prefix, status, created_at, updated_at')
        .eq('id', userData.tenant_id)
        .maybeSingle();
      tenant = data ? normalizeTenant(data) : null;
    }

    const preferences = await loadUserSettings(auth.user.id).catch(() => ({}));

    return NextResponse.json({
      success: true,
      profile: {
        id: userData?.id || auth.user.id,
        phone: userData?.phone || auth.user.phone || '',
        nickname: userData?.real_name || auth.user.nickname || auth.user.name || '',
        realName: userData?.real_name || auth.user.name || '',
        role: userData?.role || auth.user.role,
        tenantId: userData?.tenant_id || auth.user.tenant_id || null,
        tenantType: tenant?.tenant_type || auth.user.tenant_type || '',
        tenantName: tenant?.company_name || '',
        orderPrefix: tenant?.prefix || '',
        avatarUrl: '',
        bio: '',
        department: userData?.department || auth.user.department || '',
        status: userData?.is_active === false ? 'inactive' : 'active',
        createdAt: userData?.created_at || null,
      },
      tenant,
      preferences,
    });
  } catch (error) {
    console.error('get profile failed:', error);
    return NextResponse.json({ success: false, error: '????????' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;

    const parsed = profileSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || '??????' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();
    const { nickname } = parsed.data;
    const { error } = await supabase
      .from('users')
      .update({ real_name: nickname, updated_at: new Date().toISOString() })
      .eq('id', auth.user.id);

    if (error) {
      return NextResponse.json({ success: false, error: '????????' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '???????' });
  } catch (error) {
    console.error('update profile failed:', error);
    return NextResponse.json({ success: false, error: '????????' }, { status: 500 });
  }
}
