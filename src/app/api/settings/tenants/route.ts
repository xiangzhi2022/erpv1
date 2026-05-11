import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { authFailed, normalizeTenant, requireSettingsUser } from '../_utils';

function requireSuperAdmin(role: string) {
  return role === 'super_admin';
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;
    if (!requireSuperAdmin(auth.user.role)) {
      return NextResponse.json({ success: false, error: '?????????' }, { status: 403 });
    }

    const { data, error } = await getSupabaseClient()
      .from('tenants')
      .select('id, name, company_name, tenant_type, prefix, status, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ success: false, error: '????????' }, { status: 500 });
    return NextResponse.json({ success: true, tenants: (data || []).map(normalizeTenant) });
  } catch (error) {
    console.error('get tenants failed:', error);
    return NextResponse.json({ success: false, error: '????????' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;
    if (!requireSuperAdmin(auth.user.role)) {
      return NextResponse.json({ success: false, error: '???????????' }, { status: 403 });
    }

    const body = await request.json();
    const tenantType = body.tenant_type;
    const companyName = body.company_name || body.name;
    if (!tenantType || !companyName) {
      return NextResponse.json({ success: false, error: '???????????' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    if (body.prefix) {
      const { data: existing } = await supabase
        .from('tenants')
        .select('id')
        .eq('prefix', body.prefix)
        .maybeSingle();
      if (existing) return NextResponse.json({ success: false, error: '???????' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('tenants')
      .insert({ name: companyName, company_name: companyName, tenant_type: tenantType, prefix: body.prefix || null, status: body.status || 'active' })
      .select('id, name, company_name, tenant_type, prefix, status, created_at, updated_at')
      .single();

    if (error) return NextResponse.json({ success: false, error: '??????' }, { status: 500 });
    return NextResponse.json({ success: true, tenant: normalizeTenant(data) });
  } catch (error) {
    console.error('create tenant failed:', error);
    return NextResponse.json({ success: false, error: '??????' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;
    if (!requireSuperAdmin(auth.user.role)) {
      return NextResponse.json({ success: false, error: '???????????' }, { status: 403 });
    }

    const body = await request.json();
    if (!body.id) return NextResponse.json({ success: false, error: '??ID??' }, { status: 400 });

    const supabase = getSupabaseClient();
    if (body.prefix) {
      const { data: existing } = await supabase
        .from('tenants')
        .select('id')
        .eq('prefix', body.prefix)
        .neq('id', body.id)
        .maybeSingle();
      if (existing) return NextResponse.json({ success: false, error: '???????????' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.company_name !== undefined || body.name !== undefined) {
      updateData.name = body.company_name || body.name;
      updateData.company_name = body.company_name || body.name;
    }
    if (body.tenant_type !== undefined) updateData.tenant_type = body.tenant_type;
    if (body.prefix !== undefined) updateData.prefix = body.prefix || null;
    if (body.status !== undefined) updateData.status = body.status;

    const { data, error } = await supabase
      .from('tenants')
      .update(updateData)
      .eq('id', body.id)
      .select('id, name, company_name, tenant_type, prefix, status, created_at, updated_at')
      .single();

    if (error) return NextResponse.json({ success: false, error: '??????' }, { status: 500 });
    return NextResponse.json({ success: true, tenant: normalizeTenant(data) });
  } catch (error) {
    console.error('update tenant failed:', error);
    return NextResponse.json({ success: false, error: '??????' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;
    if (!requireSuperAdmin(auth.user.role)) {
      return NextResponse.json({ success: false, error: '???????????' }, { status: 403 });
    }

    const id = new URL(request.url).searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: '??ID??' }, { status: 400 });

    const supabase = getSupabaseClient();
    const { data: tenant } = await supabase.from('tenants').select('tenant_type').eq('id', id).maybeSingle();
    if (tenant?.tenant_type === 'official') {
      return NextResponse.json({ success: false, error: '????????' }, { status: 400 });
    }

    const { error } = await supabase.from('tenants').delete().eq('id', id);
    if (error) return NextResponse.json({ success: false, error: '??????' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('delete tenant failed:', error);
    return NextResponse.json({ success: false, error: '??????' }, { status: 500 });
  }
}
