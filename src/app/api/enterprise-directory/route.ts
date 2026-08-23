import { NextResponse, type NextRequest } from 'next/server';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

function positiveInteger(value: string | null, fallback: number, maximum?: number): number {
  const parsed = Number.parseInt(value || '', 10);
  const positive = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return maximum ? Math.min(maximum, positive) : positive;
}

export async function GET(request: NextRequest) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'partners.read');
    const targetType = context.enterpriseType === 'dealer'
      ? 'manufacturer'
      : context.enterpriseType === 'manufacturer'
        ? 'supplier'
        : null;
    if (!targetType) {
      return NextResponse.json({ success: false, error: '当前企业无企业库访问权限' }, { status: 403 });
    }

    const keyword = request.nextUrl.searchParams.get('keyword')?.trim() || '';
    const status = request.nextUrl.searchParams.get('status')?.trim() || '';
    const page = positiveInteger(request.nextUrl.searchParams.get('page'), 1);
    const pageSize = positiveInteger(request.nextUrl.searchParams.get('pageSize'), 10, 100);
    const from = (page - 1) * pageSize;
    const supabase = await createClient();
    let query = supabase
      .from('enterprises')
      .select('id,name,code,enterprise_type,status,created_at,updated_at', { count: 'exact' })
      .eq('enterprise_type', targetType)
      .neq('id', context.enterpriseId)
      .order('created_at', { ascending: false });

    if (keyword) {
      const safe = escapeLike(keyword);
      query = query.or(`name.ilike.%${safe}%,code.ilike.%${safe}%`);
    }
    if (status && status !== 'all') query = query.eq('status', status);
    const { data, error, count } = await query.range(from, from + pageSize - 1);
    if (error) {
      console.error('enterprise_directory.list_failed', { code: error.code });
      return NextResponse.json({ success: false, error: '获取企业目录失败' }, { status: 500 });
    }

    const rows = (data || []).map((enterprise) => ({
      id: enterprise.id,
      name: enterprise.name,
      company_name: enterprise.name,
      code: enterprise.code,
      tenant_type: enterprise.enterprise_type,
      status: enterprise.status,
      created_at: enterprise.created_at,
      updated_at: enterprise.updated_at,
      contact_person: null,
      contact_phone: null,
      address: null,
    }));
    return NextResponse.json({
      success: true,
      mode: 'readonly',
      readonly: true,
      title: targetType === 'manufacturer' ? '工厂企业' : '材料供应商',
      description: '只显示可协作企业的公开目录信息。',
      targetTenantType: targetType,
      data: rows,
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error) {
    console.error('enterprise_directory.list_failed', { error });
    return NextResponse.json({ success: false, error: '服务端错误' }, { status: 500 });
  }
}
