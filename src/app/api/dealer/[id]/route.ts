import { parseJsonObject } from '@/lib/api/request';
import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/role-access';

const getClient = () => getSupabaseClient();

// 更新经销商
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return Response.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    if (!isSuperAdmin(user)) {
      return Response.json({ success: false, error: '无权限编辑经销商' }, { status: 403 });
    }

    const { id } = await params;
    const body = await parseJsonObject(request);
    const { name, contactName, phone, region, status, remark } = body;

    if (typeof name !== 'string' || name.trim().length < 2) {
      return Response.json({ success: false, error: '经销商名称至少2个字符' }, { status: 400 });
    }

    const validStatuses = ['active', 'inactive'] as const;
    if (typeof status === 'string' && !validStatuses.includes(status as typeof validStatuses[number])) {
      return Response.json({ success: false, error: '状态值无效，仅支持 active/inactive' }, { status: 400 });
    }

    const supabase = getClient();

    // 权限检查：非管理员只能编辑自己创建的
    if (!isSuperAdmin(user)) {
      const { data: existing } = await supabase
        .from('dealers')
        .select('tenant_id')
        .eq('id', id)
        .single();
      if (!existing) {
        return Response.json({ success: false, error: '经销商不存在' }, { status: 404 });
      }
      if (!user.tenant_id || existing.tenant_id !== user.tenant_id) {
        return Response.json({ success: false, error: '无权限编辑此经销商' }, { status: 403 });
      }
    }

    const { data, error } = await supabase
      .from('dealers')
      .update({
        name: name.trim(),
        contact_name: typeof contactName === 'string' ? contactName.trim() || null : null,
        phone: typeof phone === 'string' ? phone.trim() || null : null,
        region: typeof region === 'string' ? region.trim() || null : null,
        status: typeof status === 'string' && validStatuses.includes(status as typeof validStatuses[number]) ? status : 'active',
        remark: typeof remark === 'string' ? remark.trim() || null : null,
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
    const user = await getUserFromRequest(request);
    if (!user) {
      return Response.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    if (!isSuperAdmin(user)) {
      return Response.json({ success: false, error: '无权限删除经销商' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = getClient();

    // 先检查经销商是否存在
    const { data: existing } = await supabase
      .from('dealers')
      .select('id, tenant_id')
      .eq('id', id)
      .single();

    if (!existing) {
      return Response.json({ success: false, error: '经销商不存在' }, { status: 404 });
    }

    // 权限检查：非管理员只能删除自己创建的
    if (!isSuperAdmin(user)) {
      if (!user.tenant_id || existing.tenant_id !== user.tenant_id) {
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
