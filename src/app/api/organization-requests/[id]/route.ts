import { parseJsonObject } from '@/lib/api/request';
import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import {
  approveJoinRequest,
  canManageTenantMembers,
  type TenantJoinRequestRow,
} from '@/lib/tenant-join-requests';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    const { id } = await params;
    const body = (await parseJsonObject(request)) as { action?: string; reason?: string };
    const action = body.action;

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('tenant_join_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) return jsonError(error.message, 500);
    if (!data) return jsonError('申请不存在', 404);

    const row = data as TenantJoinRequestRow;
    const isTenantAdmin = canManageTenantMembers(user) && user.tenant_id === row.tenant_id;
    const isRequester = row.user_id === user.id || Boolean(row.phone && user.phone && row.phone === user.phone);

    if (action === 'cancel') {
      if (!isRequester && !isTenantAdmin) return jsonError('无权取消该申请', 403);
      if (row.status !== 'pending') return jsonError('该申请已经处理，不能取消', 409);
      const { error: updateError } = await supabase
        .from('tenant_join_requests')
        .update({ status: 'canceled', handled_by: user.id, handled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id);
      if (updateError) return jsonError(updateError.message, 500);
      return Response.json({ success: true });
    }

    if (!isTenantAdmin) return jsonError('无权审批该申请', 403);
    if (row.status !== 'pending') return jsonError('该申请已经处理', 409);

    if (action === 'approve') {
      await approveJoinRequest(row, user);
      return Response.json({ success: true });
    }

    if (action === 'reject') {
      const { error: updateError } = await supabase
        .from('tenant_join_requests')
        .update({
          status: 'rejected',
          message: body.reason || row.message || null,
          handled_by: user.id,
          handled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (updateError) return jsonError(updateError.message, 500);
      return Response.json({ success: true });
    }

    return jsonError('未知操作', 400);
  } catch (error) {
    console.error('update organization request failed:', error);
    return jsonError(error instanceof Error ? error.message : '处理组织申请失败', 500);
  }
}
