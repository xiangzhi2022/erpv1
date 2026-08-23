import { z } from 'zod';
import { parseJson } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

const actionSchema = z.object({
  action: z.enum(['approve', 'reject', 'cancel']),
  reason: z.string().trim().max(500).optional(),
});

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const client = await createClient();
    const { data: claimsData, error: claimsError } = await client.auth.getClaims();
    const userId = claimsError ? null : claimsData?.claims?.sub ?? null;
    if (!userId) return jsonError('请先登录', 401);
    const { id } = await params;
    const body = await parseJson(request, actionSchema);
    const { data: joinRequest, error } = await client
      .from('enterprise_join_requests')
      .select('id,enterprise_id,user_id,status,requested_role_code,message')
      .eq('id', id)
      .maybeSingle();
    if (error) return jsonError('获取申请失败', 500);
    if (!joinRequest) return jsonError('申请不存在', 404);
    if (joinRequest.status !== 'pending') return jsonError('该申请已经处理', 409);

    if (body.action === 'cancel') {
      if (joinRequest.user_id !== userId) return jsonError('无权取消该申请', 403);
      const { error: cancelError } = await client
        .from('enterprise_join_requests')
        .update({
          status: 'cancelled',
          handled_by: userId,
          handled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('enterprise_id', joinRequest.enterprise_id)
        .eq('id', joinRequest.id)
        .eq('status', 'pending');
      if (cancelError) return jsonError('取消申请失败', 500);
      return Response.json({ success: true });
    }

    const context = await getEnterpriseContext();
    requirePermission(context, 'members.manage');
    if (context.enterpriseId !== joinRequest.enterprise_id) return jsonError('无权审批该申请', 403);

    if (body.action === 'reject') {
      const { error: rejectError } = await client
        .from('enterprise_join_requests')
        .update({
          status: 'rejected',
          message: body.reason ?? joinRequest.message,
          handled_by: userId,
          handled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('enterprise_id', context.enterpriseId)
        .eq('id', joinRequest.id)
        .eq('status', 'pending');
      if (rejectError) return jsonError('拒绝申请失败', 500);
      return Response.json({ success: true });
    }

    const { data: profile } = await client
      .from('profiles')
      .select('display_name,phone')
      .eq('id', joinRequest.user_id)
      .maybeSingle();
    const displayName = profile?.display_name || profile?.phone || '新成员';
    const { data: existingMembership } = await client
      .from('enterprise_memberships')
      .select('id,status')
      .eq('tenant_id', context.enterpriseId)
      .eq('user_id', joinRequest.user_id)
      .maybeSingle();
    let membershipId = existingMembership?.id ?? null;
    if (existingMembership) {
      const { error: membershipError } = await client
        .from('enterprise_memberships')
        .update({ status: 'active', display_name: displayName, updated_at: new Date().toISOString() })
        .eq('tenant_id', context.enterpriseId)
        .eq('id', existingMembership.id);
      if (membershipError) return jsonError('激活企业成员失败', 500);
    } else {
      const { data: membership, error: membershipError } = await client
        .from('enterprise_memberships')
        .insert({
          tenant_id: context.enterpriseId,
          user_id: joinRequest.user_id,
          display_name: displayName,
          status: 'active',
        })
        .select('id')
        .single();
      if (membershipError) return jsonError('创建企业成员失败', 500);
      membershipId = membership.id;
    }

    const requestedRoleCode = joinRequest.requested_role_code || 'worker';
    const { data: role } = await client
      .from('roles')
      .select('id')
      .eq('tenant_id', context.enterpriseId)
      .eq('code', requestedRoleCode)
      .maybeSingle();
    if (!role || !membershipId) return jsonError('申请的角色不存在', 409);
    await client.from('role_bindings').delete().eq('tenant_id', context.enterpriseId).eq('membership_id', membershipId).eq('scope_kind', 'enterprise');
    const { error: bindingError } = await client.from('role_bindings').insert({
      tenant_id: context.enterpriseId,
      membership_id: membershipId,
      role_id: role.id,
      scope_kind: 'enterprise',
    });
    if (bindingError) return jsonError('分配企业角色失败', 500);

    const { data: employee } = await client
      .from('employees')
      .select('id')
      .eq('enterprise_id', context.enterpriseId)
      .eq('user_id', joinRequest.user_id)
      .maybeSingle();
    if (!employee) {
      const employeeNo = `E${new Date().toISOString().slice(2, 10).replace(/-/g, '')}${joinRequest.user_id.slice(0, 4).toUpperCase()}`;
      const { error: employeeError } = await client.from('employees').insert({
        enterprise_id: context.enterpriseId,
        user_id: joinRequest.user_id,
        employee_no: employeeNo,
        name: displayName,
        phone: profile?.phone ?? null,
        status: 'active',
      });
      if (employeeError) return jsonError('创建员工档案失败', 500);
    }

    const { error: approveError } = await client
      .from('enterprise_join_requests')
      .update({
        status: 'approved',
        handled_by: userId,
        handled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('enterprise_id', context.enterpriseId)
      .eq('id', joinRequest.id)
      .eq('status', 'pending');
    if (approveError) return jsonError('批准申请失败', 500);
    return Response.json({ success: true });
  } catch (error) {
    console.error('update enterprise join request failed:', error);
    return jsonError('处理组织申请失败', 500);
  }
}
