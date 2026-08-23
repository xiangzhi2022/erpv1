import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { parseJson } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

const dealerUpdateSchema = z.object({
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'partners.manage');
    const { id } = await params;
    const input = await parseJson(request, dealerUpdateSchema);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('dealers')
      .update({
        name: input.name,
        contact_name: nullableText(input.contactName),
        phone: nullableText(input.phone),
        region: nullableText(input.region),
        status: input.status ?? 'active',
        remark: nullableText(input.remark),
        updated_at: new Date().toISOString(),
      })
      .eq('enterprise_id', context.enterpriseId)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('dealer.update_failed', { code: error.code });
      return NextResponse.json({ success: false, error: '更新经销商失败' }, { status: 500 });
    }
    if (!data) return NextResponse.json({ success: false, error: '经销商不存在' }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('dealer.update_failed', { error });
    return NextResponse.json({ success: false, error: '更新经销商失败' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'partners.manage');
    const { id } = await params;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('dealers')
      .delete()
      .eq('enterprise_id', context.enterpriseId)
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('dealer.delete_failed', { code: error.code });
      return NextResponse.json({ success: false, error: '删除经销商失败' }, { status: 500 });
    }
    if (!data) return NextResponse.json({ success: false, error: '经销商不存在' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('dealer.delete_failed', { error });
    return NextResponse.json({ success: false, error: '删除经销商失败' }, { status: 500 });
  }
}
