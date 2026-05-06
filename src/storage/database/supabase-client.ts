import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 角色层级定义
export const roleHierarchy: Record<string, number> = {
  'super_admin': 100,
  'saas_admin': 80,
  'dealer_admin': 60,
  'factory_admin': 50,
  'supplier_admin': 50,
  'factory_user': 30,
  'user': 10,
};

// 角色对应的跳转路径
export const roleRedirectPath: Record<string, string> = {
  'super_admin': '/',
  'saas_admin': '/',
  'dealer_admin': '/dealer',
  'factory_admin': '/factory',
  'supplier_admin': '/supplier',
  'factory_user': '/worker',
  'user': '/dashboard',
};

// 检查是否有权限
export function hasPermission(userRole: string, requiredRole: string): boolean {
  return (roleHierarchy[userRole] ?? 0) >= (roleHierarchy[requiredRole] ?? 0);
}

// 获取 Supabase 客户端
export function getSupabaseClient(token?: string): SupabaseClient {
  // 强制使用新的 Supabase URL
  const url = 'https://cdcnjtgabgjkouavwxsl.supabase.co';
  const anonKey = process.env.COZE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkY25qdGdhYmdqa291YXZ3eHNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NTIzNDEsImV4cCI6MjA5MzQyODM0MX0.HM6oAvBbY-PCDXbMpR_H4swyKprHM58mXP44u3onXEQ';

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
  // 强制使用新的 Supabase URL 和 Key
  const url = 'https://cdcnjtgabgjkouavwxsl.supabase.co';
  const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkY25qdGdhYmdqa291YXZ3eHNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzg1MjM0MSwiZXhwIjoyMDkzNDI4MzQxfQ.LzvwvnkQx_lIjIjsZd8FxyXRaDwTPyiVELyTEuTacmE';

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
