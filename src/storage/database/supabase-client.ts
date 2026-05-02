import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 角色层级定义
export const roleHierarchy: Record<string, number> = {
  'super_admin': 100,
  'saas_admin': 80,
  'dealer_admin': 60,
  'factory_admin': 50,
  'factory_user': 30,
  'user': 10,
};

// 角色对应的跳转路径
export const roleRedirectPath: Record<string, string> = {
  'super_admin': '/',
  'saas_admin': '/',
  'dealer_admin': '/dealer',
  'factory_admin': '/factory',
  'factory_user': '/worker',
  'user': '/dashboard',
};

// 检查是否有权限
export function hasPermission(userRole: string, requiredRole: string): boolean {
  return (roleHierarchy[userRole] ?? 0) >= (roleHierarchy[requiredRole] ?? 0);
}

// 获取 Supabase 客户端
export function getSupabaseClient(token?: string): SupabaseClient {
  const url = process.env.COZE_SUPABASE_URL;
  const anonKey = process.env.COZE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error('Missing Supabase credentials:', { url: !!url, anonKey: !!anonKey });
    throw new Error('Supabase credentials not configured');
  }

  const globalOptions: Record<string, unknown> = {};
  if (token) {
    globalOptions.headers = { Authorization: `Bearer ${token}` };
  }

  return createClient(url, anonKey, {
    global: globalOptions,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// 获取服务角色客户端（用于管理员操作）
export function getSupabaseServiceClient(): SupabaseClient {
  const url = process.env.COZE_SUPABASE_URL;
  const serviceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('Missing Supabase service credentials:', { url: !!url, serviceKey: !!serviceKey });
    throw new Error('Supabase service credentials not configured');
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getUserFromCookie(cookieHeader: string | null) {
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').reduce((acc: Record<string, string>, cookie) => {
    const [key, value] = cookie.trim().split('=');
    if (key && value) {
      acc[key] = decodeURIComponent(value);
    }
    return acc;
  }, {});
  
  if (cookies.user) {
    try {
      return JSON.parse(cookies.user);
    } catch {
      return null;
    }
  }
  return null;
}
