import { getSupabaseClient } from '@/db/client';
import { cookies } from 'next/headers';

const getClient = () => getSupabaseClient();

async function getCurrentUser() {
  const cookieStore = await cookies();
  const userStr = cookieStore.get('erp_user')?.value;
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

// 更新经销商
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, contactName, phone, region, status, remark } = body;

    if (!name || name.trim().length < 2) {
      return Response.json({ success: false, error: '经销商名称至少2个字符' }, { status: 400 });
    }

    const supabase = getClient();

    // 权限检查：非管理员只能编辑自己创建的
    if (user.role !== 'super_admin' && user.role !== 'saas_admin') {
      const { data: existing } = await supabase
        .from('dealers')
        .select('created_by')
        .eq('id', id)
        .single();
      if (existing && existing.created_by !== user.id) {
        return Response.json({ success: false, error: '无权限编辑此经销商' }, { status: 403 });
      }
    }

    const { data, error } = await supabase
      .from('dealers')
      .update({
        name: name.trim(),
        contact_name: contactName?.trim() || null,
        phone: phone?.trim() || null,
        region: region?.trim() || null,
        status: status || 'active',
        remark: remark?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!data) {
      return Response.json({ success: false, error: '经销商不存在' }, { status: 404 });
    }

    return Response.json({ success: true, data });
  } catch (err) {
    console.error('Update dealer error:', err);
    return Response.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

// 删除经销商
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = getClient();

    // 权限检查：非管理员只能删除自己创建的
    if (user.role !== 'super_admin' && user.role !== 'saas_admin') {
      const { data: existing } = await supabase
        .from('dealers')
        .select('created_by')
        .eq('id', id)
        .single();
      if (existing && existing.created_by !== user.id) {
        return Response.json({ success: false, error: '无权限删除此经销商' }, { status: 403 });
      }
    }

    const { error } = await supabase
      .from('dealers')
      .delete()
      .eq('id', id);

    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('Delete dealer error:', err);
    return Response.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
