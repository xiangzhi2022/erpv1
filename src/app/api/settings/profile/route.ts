import { parseJsonObject } from '@/lib/api/request';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { profileSchema } from '@/app/settings/schemas';
import { authFailed, loadUserSettings, normalizeTenant, requireSettingsUser } from '../_utils';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;

    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('id, phone, display_name, avatar_url, enterprise_id, created_at')
      .eq('enterprise_id', auth.context.enterpriseId)
      .eq('id', auth.user.id)
      .maybeSingle();

    if (userError) {
      return NextResponse.json({ success: false, error: '????????' }, { status: 500 });
    }

    const [{ data: enterprise }, { data: prefixRow }] = await Promise.all([
      supabase
        .from('enterprises')
        .select('id,name,enterprise_type,status,created_at,updated_at')
        .eq('id', auth.context.enterpriseId)
        .maybeSingle(),
      supabase
        .from('order_prefixes')
        .select('prefix')
        .eq('enterprise_id', auth.context.enterpriseId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);
    const tenant = enterprise ? normalizeTenant({
      ...enterprise,
      tenant_type: enterprise.enterprise_type,
      company_name: enterprise.name,
      prefix: prefixRow?.prefix ?? '',
    }) : null;

    const preferences = await loadUserSettings(auth.user.id, auth.context.enterpriseId).catch(() => ({}));

    return NextResponse.json({
      success: true,
      profile: {
        id: userData?.id || auth.user.id,
        phone: userData?.phone || auth.user.phone || '',
        nickname: userData?.display_name || auth.user.nickname || auth.user.name || '',
        realName: userData?.display_name || auth.user.name || '',
        role: auth.user.role,
        tenantId: auth.context.enterpriseId,
        tenantType: tenant?.tenant_type || auth.user.tenant_type || '',
        tenantName: tenant?.company_name || '',
        orderPrefix: tenant?.prefix || '',
        avatarUrl: userData?.avatar_url || '',
        bio: '',
        department: auth.user.department || '',
        status: 'active',
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

    const parsed = profileSchema.safeParse(await parseJsonObject(request));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || '??????' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { nickname } = parsed.data;
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: nickname, updated_at: new Date().toISOString() })
      .eq('enterprise_id', auth.context.enterpriseId)
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
