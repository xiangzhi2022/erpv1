import { z } from 'zod';
import { allowNullableRpcArgs } from '@/db/rpc-args';
import { parseJson } from '@/lib/api/request';
import { createClient } from '@/lib/supabase/server';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';

const createJoinRequestSchema = z.object({
  enterprise_id: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional(),
  requested_role_code: z.string().trim().min(1).max(80).optional(),
  role: z.string().trim().min(1).max(80).optional(),
  message: z.string().trim().max(500).nullable().optional(),
});

async function verifiedUserId() {
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  return error ? null : data?.claims?.sub ?? null;
}

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function GET(request: Request) {
  try {
    const userId = await verifiedUserId();
    if (!userId) return jsonError('请先登录', 401);
    const searchParams = new URL(request.url).searchParams;
    const status = searchParams.get('status') ?? 'pending';
    if (!['pending', 'approved', 'rejected', 'cancelled', 'all'].includes(status)) {
      return jsonError('申请状态不正确', 400);
    }
    let enterpriseId: string | null = null;
    if (searchParams.get('scope') === 'enterprise') {
      const context = await getEnterpriseContext();
      requirePermission(context, 'members.manage');
      enterpriseId = context.enterpriseId;
    }
    const client = await createClient();
    const { data, error } = await client.rpc('list_enterprise_join_requests', allowNullableRpcArgs<
      'list_enterprise_join_requests',
      'target_enterprise_id'
    >({
      target_enterprise_id: enterpriseId,
      target_status: status,
    }));
    if (error) return jsonError('获取组织申请失败', 500);
    return Response.json({ success: true, data: data ?? [] });
  } catch (error) {
    console.error('get enterprise join requests failed:', error);
    return jsonError('获取组织申请失败', 500);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await verifiedUserId();
    if (!userId) return jsonError('请先登录', 401);
    const body = await parseJson(request, createJoinRequestSchema);
    const enterpriseId = body.enterprise_id ?? body.tenant_id;
    if (!enterpriseId) return jsonError('请选择要加入的企业', 400);
    const requestedRole = body.requested_role_code ?? body.role ?? 'worker';
    if (!['worker', 'employee'].includes(requestedRole)) {
      return jsonError('自助加入申请仅支持员工角色', 422);
    }
    const client = await createClient();
    const { data, error } = await client.rpc('create_enterprise_join_request', allowNullableRpcArgs<
      'create_enterprise_join_request',
      'target_message'
    >({
      target_enterprise_id: enterpriseId,
      target_message: body.message ?? null,
    }));
    if (error?.message === 'already_active_member') return jsonError('你已经是该企业成员', 409);
    if (error?.message === 'join_request_pending') return jsonError('已有待处理申请，请勿重复提交', 409);
    if (error?.message === 'enterprise_not_found') return jsonError('企业不存在或不可加入', 404);
    if (error) return jsonError('创建组织申请失败', 500);
    return Response.json({ success: true, data }, { status: 201 });
  } catch (error) {
    console.error('create enterprise join request failed:', error);
    return jsonError('创建组织申请失败', 500);
  }
}
