import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('workshops')
      .select('id, name, code')
      .eq('status', 'active')
      .order('name');

    if (error) {
      throw new Error(`查询车间列表失败: ${error.message}`);
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器错误';
    console.error('获取车间列表失败:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
