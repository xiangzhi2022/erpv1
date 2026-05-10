/**
 * 后端数据库操作模块
 * 使用 Supabase REST API 直接操作数据库
 *
 * 所有凭证统一通过 @/db/client 的 getSupabaseCredentials() 获取，
 * 确保环境变量优先级、localhost 拒绝、legacy 兼容等规则一致。
 */

import { getSupabaseCredentials } from '@/db/client';

interface SqlParams {
  sql: string;
  params?: (string | number | boolean | null)[];
}

interface SqlResult {
  rows?: Record<string, unknown>[];
  rowCount?: number;
}

/**
 * 获取服务端 REST API 所需的 url + serviceKey。
 * 缺少 service_role_key 时直接抛出明确错误。
 */
function getServiceCredentials(): { url: string; serviceKey: string } {
  const { url, serviceRoleKey } = getSupabaseCredentials();
  if (!serviceRoleKey) {
    throw new Error(
      'COZE_SUPABASE_SERVICE_ROLE_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) is required ' +
        'for server-side database operations. Please configure it in your environment.'
    );
  }
  return { url, serviceKey: serviceRoleKey };
}

/**
 * 执行 SQL 查询
 * 使用 Service Role Key 绕过 RLS
 */
export async function execSql({ sql, params = [] }: SqlParams): Promise<SqlResult> {
  const { url, serviceKey } = getServiceCredentials();

  const apiUrl = `${url}/rest/v1/rpc/exec`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      query: sql,
      params: params.length > 0 ? params : null,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Database error: ${error}`);
  }

  const data = await response.json();
  return {
    rows: Array.isArray(data) ? data : [data],
    rowCount: Array.isArray(data) ? data.length : 1,
  };
}

/**
 * 直接插入数据到表（使用 Service Role Key）
 */
export async function insertData(table: string, data: Record<string, unknown>): Promise<void> {
  const { url, serviceKey } = getServiceCredentials();

  const apiUrl = `${url}/rest/v1/${table}`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Insert error: ${error}`);
  }
}

/**
 * 直接删除数据（使用 Service Role Key）
 */
export async function deleteData(table: string, filters: Record<string, string>): Promise<void> {
  const { url, serviceKey } = getServiceCredentials();

  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    queryParams.append(`${key}`, `eq.${value}`);
  }

  const apiUrl = `${url}/rest/v1/${table}?${queryParams.toString()}`;

  const response = await fetch(apiUrl, {
    method: 'DELETE',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Delete error: ${error}`);
  }
}

/**
 * 直接查询数据（使用 Service Role Key）
 */
export async function selectData(
  table: string,
  filters?: Record<string, string>,
  columns?: string
): Promise<Record<string, unknown>[]> {
  const { url, serviceKey } = getServiceCredentials();

  const queryParams = new URLSearchParams();
  if (columns) {
    queryParams.append('select', columns);
  } else {
    queryParams.append('select', '*');
  }

  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      queryParams.append(`${key}`, `eq.${value}`);
    }
  }

  const apiUrl = `${url}/rest/v1/${table}?${queryParams.toString()}`;

  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Select error: ${error}`);
  }

  return await response.json();
}
