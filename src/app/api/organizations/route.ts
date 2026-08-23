import { parseJsonObject } from '@/lib/api/request';
import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ACTIVE_TENANT_COOKIE_NAME, isProduction } from '@/lib/auth';
import { isEnterprisePermissionCode } from '@/lib/enterprise/permissions';
import { getLandingPath } from '@/lib/role-access';
import { createClient } from '@/lib/supabase/server';

const switchEnterpriseSchema = z.object({
  enterpriseId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
}).strict();

interface MembershipRow {
  id: string;
  tenant_id: string;
  display_name: string;
  status: 'invited' | 'active' | 'suspended';
  enterprise: {
    id: string;
    name: string;
    enterprise_type: string;
    status: string;
  } | null;
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

async function verifiedUserId() {
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  return {
    client,
    userId: error || !data?.claims?.sub ? null : data.claims.sub,
  };
}

export async function GET(request: NextRequest) {
  const { client, userId } = await verifiedUserId();
  if (!userId) return errorResponse('IDENTITY_REQUIRED', '请先登录', 401);

  const { data, error } = await client
    .from('enterprise_memberships')
    .select('id,tenant_id,display_name,status,enterprise:enterprises(id,name,enterprise_type,status)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) {
    return errorResponse('ENTERPRISE_CONTEXT_UNAVAILABLE', '企业列表暂时不可用', 503);
  }

  const organizations = ((data ?? []) as MembershipRow[])
    .filter((row) => row.status === 'active' && row.enterprise?.status === 'active')
    .map((row) => ({
      enterpriseId: row.tenant_id,
      membershipId: row.id,
      enterpriseName: row.enterprise?.name ?? '未命名企业',
      enterpriseType: row.enterprise?.enterprise_type ?? '',
      displayName: row.display_name,
    }));
  const requestedId = request.cookies.get(ACTIVE_TENANT_COOKIE_NAME)?.value;
  const activeEnterpriseId = requestedId && organizations.some(
    (organization) => organization.enterpriseId === requestedId,
  )
    ? requestedId
    : organizations.length === 1
      ? organizations[0].enterpriseId
      : null;

  return NextResponse.json({ success: true, activeEnterpriseId, organizations });
}

export async function POST(request: NextRequest) {
  let unknownBody: unknown;
  try {
    unknownBody = await parseJsonObject(request);
  } catch {
    return errorResponse('INVALID_REQUEST', '请求内容格式错误', 400);
  }
  const parsed = switchEnterpriseSchema.safeParse(unknownBody);
  if (!parsed.success) return errorResponse('INVALID_REQUEST', '企业选择参数无效', 400);

  const { client, userId } = await verifiedUserId();
  if (!userId) return errorResponse('IDENTITY_REQUIRED', '请先登录', 401);

  const { data, error } = await client.rpc('authorize_enterprise_selection', {
    target_enterprise_id: parsed.data.enterpriseId,
    target_idempotency_key: parsed.data.idempotencyKey,
    target_correlation_id: randomUUID(),
    caller_user_agent: request.headers.get('user-agent') ?? undefined,
  });
  const selection = data?.[0];
  if (error || !selection?.allowed || selection.tenant_id !== parsed.data.enterpriseId) {
    return errorResponse('ENTERPRISE_ACCESS_FORBIDDEN', '你没有该企业的有效访问权限', 403);
  }

  const { data: grantRows, error: grantError } = await client.rpc('current_enterprise_grants', {
    target_tenant_id: selection.tenant_id,
  });
  if (grantError) {
    return errorResponse('ENTERPRISE_CONTEXT_UNAVAILABLE', '企业权限暂时不可用', 503);
  }
  const grants = new Set(
    (grantRows ?? [])
      .map((row) => row.permission)
      .filter(isEnterprisePermissionCode),
  );
  const redirectTo = getLandingPath({ grants });
  const response = NextResponse.json({
    success: true,
    activeEnterpriseId: selection.tenant_id,
    redirectTo,
  });
  response.cookies.set(ACTIVE_TENANT_COOKIE_NAME, selection.tenant_id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    maxAge: 30 * 24 * 60 * 60,
  });
  return response;
}
