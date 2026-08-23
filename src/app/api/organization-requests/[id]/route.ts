import { z } from 'zod';
import { parseJson } from '@/lib/api/request';
import { createClient } from '@/lib/supabase/server';

const actionSchema = z.object({
  action: z.enum(['approve', 'reject', 'cancel']),
  reason: z.string().trim().max(500).optional(),
}).strict();
const requestIdSchema = z.string().uuid();

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const client = await createClient();
    const { data: claimsData, error: claimsError } = await client.auth.getClaims();
    if (claimsError || !claimsData?.claims?.sub) return jsonError('请先登录', 401);
    const parsedId = requestIdSchema.safeParse((await params).id);
    if (!parsedId.success) return jsonError('申请 ID 不正确', 400);
    const body = await parseJson(request, actionSchema);
    const { data, error } = await client.rpc('handle_enterprise_join_request', {
      target_action: body.action,
      target_reason: body.reason ?? null,
      target_request_id: parsedId.data,
    });
    if (error?.message === 'join_request_not_found') return jsonError('申请不存在', 404);
    if (error?.message === 'join_request_already_handled') return jsonError('该申请已经处理', 409);
    if (error?.message === 'already_active_member') return jsonError('该用户已经是启用的企业成员', 409);
    if (error?.message === 'permission_denied') return jsonError('无权处理该申请', 403);
    if (error?.message === 'requested_role_not_allowed') return jsonError('申请角色不允许自助审批', 409);
    if (error?.message === 'role_not_assignable') return jsonError('不能审批超出当前账号权限范围的角色', 403);
    if (error) return jsonError('处理组织申请失败', 500);
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('update enterprise join request failed:', error);
    return jsonError('处理组织申请失败', 500);
  }
}
