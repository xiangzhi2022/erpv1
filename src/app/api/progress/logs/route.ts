import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';

// Get progress logs for a work order
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workOrderId = searchParams.get('work_order_id');

    if (!workOrderId) {
      return NextResponse.json(
        { success: false, error: '缺少 work_order_id 参数' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('progress_logs')
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(`查询进度日志失败: ${error.message}`);
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : '服务器错误';
    console.error('获取进度日志失败:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
