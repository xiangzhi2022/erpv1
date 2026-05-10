import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSession } from '@/lib/auth';

function getSupabaseAdmin() {
  const url = process.env.COZE_SUPABASE_URL;
  const key = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getAuthUser() {
  try {
    const session = await getSession();
    if (session?.user) {
      return { id: session.user.id, role: 'admin', name: session.user.name };
    }
  } catch {
    // ignore
  }
  return null;
}

// GET - 工人统计
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    const supabase = getSupabaseAdmin();

    const { data: allWorkers, error: workerError } = await supabase.from('workers').select('status, craft_type');
    if (workerError) {
      console.error('获取工人统计失败:', workerError);
      return NextResponse.json({ success: false, error: '获取统计失败' }, { status: 500 });
    }

    const workers = allWorkers || [];
    const total = workers.length;
    const active = workers.filter((w: { status: string }) => w.status === 'active').length;
    const onLeave = workers.filter((w: { status: string }) => w.status === 'on_leave').length;
    const resigned = workers.filter((w: { status: string }) => w.status === 'resigned').length;

    const craftDistribution: Record<string, number> = {};
    workers.forEach((w: { craft_type: string | null }) => {
      const craft = w.craft_type || 'unassigned';
      craftDistribution[craft] = (craftDistribution[craft] || 0) + 1;
    });

    const activeRate = total > 0 ? Math.round((active / total) * 100) : 0;

    return NextResponse.json({
      success: true,
      stats: { total, active, onLeave, resigned, activeRate, craftDistribution },
    });
  } catch (error) {
    console.error('获取工人统计失败:', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
