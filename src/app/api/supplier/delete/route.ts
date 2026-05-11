import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/role-access';

// DELETE - 删除供应商
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: '缺少供应商ID' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 先验证供应商存在
    const { data: existing, error: fetchError } = await supabase
      .from('suppliers')
      .select('id, name, supplier_code, tenant_id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ success: false, error: '供应商不存在' }, { status: 404 });
    }
    if (!isSuperAdmin(user) && (!user.tenant_id || existing.tenant_id !== user.tenant_id)) {
      return NextResponse.json({ success: false, error: '无权限删除该供应商' }, { status: 403 });
    }

    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('删除供应商数据库错误:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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
