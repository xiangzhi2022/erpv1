import { z } from 'zod';
import { parseJson } from '@/lib/api/request';
import { createClient } from '@/lib/supabase/server';

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
    const status = new URL(request.url).searchParams.get('status') ?? 'pending';
    const client = await createClient();
    let query = client
      .from('enterprise_join_requests')
      .select('id,enterprise_id,user_id,status,requested_role_code,message,handled_by,handled_at,created_at,updated_at,enterprise:enterprises(id,name,enterprise_type,status)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (status !== 'all') query = query.eq('status', status);
    const { data, error } = await query;
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
    const client = await createClient();
    const { data: membership } = await client
      .from('enterprise_memberships')
      .select('id,status')
      .eq('tenant_id', enterpriseId)
      .eq('user_id', userId)
      .maybeSingle();
    if (membership?.status === 'active') return jsonError('你已经是该企业成员', 409);

    const requestedRoleCode = body.requested_role_code ?? body.role ?? 'worker';
    const { data: existing, error: existingError } = await client
      .from('enterprise_join_requests')
      .select('id,status')
      .eq('enterprise_id', enterpriseId)
      .eq('user_id', userId)
      .maybeSingle();
    if (existingError) return jsonError('创建组织申请失败', 500);
    if (existing?.status === 'pending') return jsonError('已有待处理申请，请勿重复提交', 409);

    const values = {
      enterprise_id: enterpriseId,
      user_id: userId,
      status: 'pending' as const,
      requested_role_code: requestedRoleCode,
      message: body.message ?? null,
      handled_by: null,
      handled_at: null,
      updated_at: new Date().toISOString(),
    };
    const mutation = existing
      ? client.from('enterprise_join_requests').update(values).eq('enterprise_id', enterpriseId).eq('id', existing.id)
      : client.from('enterprise_join_requests').insert(values);
    const { data, error } = await mutation
      .select('id,enterprise_id,user_id,status,requested_role_code,message,handled_by,handled_at,created_at,updated_at')
      .single();
    if (error) return jsonError('创建组织申请失败', 500);
    return Response.json({ success: true, data }, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error('create enterprise join request failed:', error);
    return jsonError('创建组织申请失败', 500);
  }
}
