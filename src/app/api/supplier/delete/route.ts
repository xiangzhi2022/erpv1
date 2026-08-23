import { NextRequest, NextResponse } from 'next/server';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

// DELETE - 删除供应商
export async function DELETE(request: NextRequest) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'partners.manage');

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: '缺少供应商ID' }, { status: 400 });
    }

    const supabase = await createClient();

    // 先验证供应商存在
    const { data: existing, error: fetchError } = await supabase
      .from('suppliers')
      .select('id, name, supplier_code')
      .eq('enterprise_id', context.enterpriseId)
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ success: false, error: '供应商不存在' }, { status: 404 });
    }
    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('enterprise_id', context.enterpriseId)
      .eq('id', id);

    if (error) {
      console.error('删除供应商数据库错误:', error);
      return NextResponse.json({ success: false, error: '删除供应商失败' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: { id: existing.id, name: existing.name, supplier_code: existing.supplier_code },
    });
  } catch (error) {
    console.error('删除供应商失败:', error);
    return NextResponse.json({ success: false, error: '删除供应商失败' }, { status: 500 });
  }
}
