import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJson } from '@/lib/api/request';
import { authFailed, normalizeTenant, requireSettingsUser } from '../_utils';
import { createClient } from '@/lib/supabase/server';

const updateEnterpriseSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  company_name: z.string().trim().min(1).max(100).optional(),
  enterprise_type: z.string().trim().min(1).max(40).optional(),
  tenant_type: z.string().trim().min(1).max(40).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;
    const client = await createClient();
    const [{ data, error }, { data: prefix }] = await Promise.all([
      client
        .from('enterprises')
        .select('id,name,enterprise_type,status,created_at,updated_at')
        .eq('id', auth.context.enterpriseId)
        .maybeSingle(),
      client
        .from('order_prefixes')
        .select('prefix')
        .eq('enterprise_id', auth.context.enterpriseId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);
    if (error || !data) {
      return NextResponse.json({ success: false, error: '获取企业信息失败' }, { status: 500 });
    }
    const tenant = normalizeTenant({
      ...data,
      tenant_type: data.enterprise_type,
      company_name: data.name,
      prefix: prefix?.prefix ?? '',
    });
    return NextResponse.json({ success: true, tenants: [tenant] });
  } catch (error) {
    console.error('get enterprise settings failed:', error);
    return NextResponse.json({ success: false, error: '获取企业信息失败' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;
    const body = await parseJson(request, updateEnterpriseSchema);
    const name = body.company_name ?? body.name;
    const enterpriseType = body.enterprise_type ?? body.tenant_type;
    if (!name && !enterpriseType) {
      return NextResponse.json({ success: false, error: '没有可更新的企业信息' }, { status: 400 });
    }
    const client = await createClient();
    const { data, error } = await client
      .from('enterprises')
      .update({
        ...(name ? { name } : {}),
        ...(enterpriseType ? { enterprise_type: enterpriseType } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', auth.context.enterpriseId)
      .select('id,name,enterprise_type,status,created_at,updated_at')
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ success: false, error: '更新企业信息失败' }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      tenant: normalizeTenant({
        ...data,
        tenant_type: data.enterprise_type,
        company_name: data.name,
      }),
    });
  } catch (error) {
    console.error('update enterprise settings failed:', error);
    return NextResponse.json({ success: false, error: '更新企业信息失败' }, { status: 500 });
  }
}

export function POST() {
  return NextResponse.json({ success: false, error: '请通过企业入驻流程创建企业' }, { status: 405 });
}

export function DELETE() {
  return NextResponse.json({ success: false, error: '不支持通过设置页面删除企业' }, { status: 405 });
}
