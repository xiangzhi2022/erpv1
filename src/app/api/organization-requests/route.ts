import { parseJsonObject } from '@/lib/api/request';
import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import {
  canManageTenantMembers,
  normalizeMemberRole,
  normalizePhone,
  type TenantJoinRequestRow,
  type TenantJoinRequestType,
} from '@/lib/tenant-join-requests';

type AuthUser = NonNullable<Awaited<ReturnType<typeof getUserFromRequest>>>;

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

function canSeeRequest(user: AuthUser, row: TenantJoinRequestRow): boolean {
  if (canManageTenantMembers(user) && user.tenant_id && row.tenant_id === user.tenant_id) return true;
  if (row.user_id && row.user_id === user.id) return true;
  return Boolean(row.phone && user.phone && row.phone === user.phone);
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const supabase = getSupabaseClient();
    let query = supabase
      .from('tenant_join_requests')
      .select('*, tenant:tenants(id,company_name,name,tenant_type), user:users!tenant_join_requests_user_id_fkey(id,phone,real_name,nickname)')
      .order('created_at', { ascending: false });

    if (status !== 'all') query = query.eq('status', status);
    if (canManageTenantMembers(user) && user.tenant_id) {
      query = query.eq('tenant_id', user.tenant_id);
    } else {
      query = user.phone
        ? query.or(`user_id.eq.${user.id},phone.eq.${user.phone}`)
        : query.eq('user_id', user.id);
    }

    const { data, error } = await query;
    if (error) return jsonError(error.message, 500);
    return Response.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('get organization requests failed:', error);
    return jsonError('获取组织申请失败', 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);

    const body = (await parseJsonObject(request)) as Record<string, unknown>;
    const requestType = body.request_type === 'org_invite' ? 'org_invite' : 'employee_apply' as TenantJoinRequestType;
    const supabase = getSupabaseClient();

    let tenantId = typeof body.tenant_id === 'string' ? body.tenant_id.trim() : '';
    let phone = normalizePhone(body.phone) || user.phone || null;
    let userId: string | null = null;
    let requestedBy = user.id;
    let role = normalizeMemberRole(body.role);

    if (requestType === 'org_invite') {
      if (!canManageTenantMembers(user) || !user.tenant_id) return jsonError('无权邀请员工加入组织', 403);
      tenantId = user.tenant_id;
      phone = normalizePhone(body.phone);
      if (!phone) return jsonError('请输入正确的员工手机号', 400);
      const { data: targetUser, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();
      if (userError) return jsonError(userError.message, 500);
      userId = targetUser?.id || null;
    } else {
      if (!tenantId) return jsonError('请选择要加入的企业', 400);
      if (!phone) return jsonError('当前账号缺少手机号，不能发起加入申请', 400);
      userId = user.id;
      requestedBy = user.id;
      role = 'employee';
    }

    const { data: existingMember, error: memberError } = userId
      ? await supabase.from('tenant_users').select('id').eq('tenant_id', tenantId).eq('user_id', userId).eq('status', 'active').maybeSingle()
      : await supabase.from('tenant_users').select('id').eq('tenant_id', tenantId).eq('phone', phone).eq('status', 'active').maybeSingle();
    if (memberError) return jsonError(memberError.message, 500);
    if (existingMember?.id) return jsonError('该员工已经在当前组织中', 409);

    const { data: pending, error: pendingError } = await supabase
      .from('tenant_join_requests')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('phone', phone)
      .eq('request_type', requestType)
      .eq('status', 'pending')
      .maybeSingle();
    if (pendingError) return jsonError(pendingError.message, 500);
    if (pending?.id) return jsonError('已有待处理申请，请勿重复提交', 409);

    const { data, error } = await supabase
      .from('tenant_join_requests')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        phone,
        name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : user.nickname || user.name || phone,
        request_type: requestType,
        status: 'pending',
        role,
        department: typeof body.department === 'string' && body.department.trim() ? body.department.trim() : null,
        employee_no: typeof body.employee_no === 'string' && body.employee_no.trim() ? body.employee_no.trim() : null,
        message: typeof body.message === 'string' && body.message.trim() ? body.message.trim() : null,
        requested_by: requestedBy,
        updated_at: new Date().toISOString(),
      })
      .select('*, tenant:tenants(id,company_name,name,tenant_type), user:users!tenant_join_requests_user_id_fkey(id,phone,real_name,nickname)')
      .single();
    if (error) return jsonError(error.message, 500);

    const row = data as TenantJoinRequestRow;
    if (!canSeeRequest(user, row)) return jsonError('无权查看该申请', 403);
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('create organization request failed:', error);
    return jsonError('创建组织申请失败', 500);
  }
}
