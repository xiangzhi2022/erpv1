import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { parseJson } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

const dealerInputSchema = z.object({
  name: z.string().trim().min(2, '经销商名称至少2个字符'),
  contactName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  remark: z.string().nullable().optional(),
});

function nullableText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized || null;
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
    const supabase = await createClient();
    const keyword = request.nextUrl.searchParams.get('keyword')?.trim() || '';
    const region = request.nextUrl.searchParams.get('region')?.trim() || '';
    const status = request.nextUrl.searchParams.get('status')?.trim() || '';
    const page = positiveInteger(request.nextUrl.searchParams.get('page'), 1);
    const pageSize = positiveInteger(request.nextUrl.searchParams.get('pageSize'), 10, 100);

    let query = supabase
      .from('dealers')
      .select('*', { count: 'exact' })
      .eq('enterprise_id', context.enterpriseId)
      .order('created_at', { ascending: false });

    if (keyword) {
      const safe = keyword.replace(/[%_\\]/g, '\\$&');
      query = query.or(`name.ilike.%${safe}%,contact_name.ilike.%${safe}%,phone.ilike.%${safe}%`);
    }
    if (region) query = query.eq('region', region);
    if (status) query = query.eq('status', status);

    const from = (page - 1) * pageSize;
    const { data, error, count } = await query.range(from, from + pageSize - 1);
    if (error) {
      console.error('dealer.list_failed', { code: error.code });
      return NextResponse.json({ success: false, error: '查询经销商失败' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error) {
    console.error('dealer.list_failed', { error });
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'partners.manage');
    const input = await parseJson(request, dealerInputSchema);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('dealers')
      .insert({
        enterprise_id: context.enterpriseId,
        name: input.name,
        contact_name: nullableText(input.contactName),
        phone: nullableText(input.phone),
        region: nullableText(input.region),
        status: input.status ?? 'active',
        remark: nullableText(input.remark),
        created_by: context.userId,
      })
      .select()
      .single();

    if (error) {
      console.error('dealer.create_failed', { code: error.code });
      return NextResponse.json({ success: false, error: '创建经销商失败' }, { status: 500 });
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('dealer.create_failed', { error });
    return NextResponse.json({ success: false, error: '创建经销商失败' }, { status: 500 });
  }
}
