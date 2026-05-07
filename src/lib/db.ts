/**
 * 后端数据库操作模块
 * 使用 Supabase REST API 直接操作数据库
 */

interface SqlParams {
  sql: string;
  params?: (string | number | boolean | null)[];
}

interface SqlResult {
  rows?: Record<string, unknown>[];
  rowCount?: number;
}

/**
 * 执行 SQL 查询
 * 使用 Service Role Key 绕过 RLS
 */
export async function execSql({ sql, params = [] }: SqlParams): Promise<SqlResult> {
  const url = process.env.COZE_SUPABASE_URL;
  const serviceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase credentials');
  }

  // 构建 pg API 请求
  const apiUrl = `${url}/rest/v1/rpc/exec`;
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    },
    body: JSON.stringify({
      query: sql,
      params: params.length > 0 ? params : null
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Database error: ${error}`);
  }

  const data = await response.json();
  return {
    rows: Array.isArray(data) ? data : [data],
    rowCount: Array.isArray(data) ? data.length : 1
  };
}

/**
 * 直接插入数据到表（使用 Service Role Key）
 */
export async function insertData(table: string, data: Record<string, unknown>): Promise<void> {
  const url = process.env.COZE_SUPABASE_URL;
  const serviceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase credentials');
  }

  const apiUrl = `${url}/rest/v1/${table}`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
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
  const url = process.env.COZE_SUPABASE_URL;
  const serviceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase credentials');
  }

  // 构建查询参数
  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    queryParams.append(`${key}`, `eq.${value}`);
  }

  const apiUrl = `${url}/rest/v1/${table}?${queryParams.toString()}`;

  const response = await fetch(apiUrl, {
    method: 'DELETE',
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    }
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
  const url = process.env.COZE_SUPABASE_URL;
  const serviceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase credentials');
  }

  // 构建查询参数
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
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Select error: ${error}`);
  }

  return await response.json();
}
