import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.COZE_SUPABASE_URL || 'https://cdcnjtgabgjkouavwxsl.supabase.co';
const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkY25qdGdhYmdqa291YXZ3eHNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzg1MjM0MSwiZXhwIjoyMDkzNDI4MzQxfQ.LzvwvnkQx_lIjIjsZd8FxyXRaDwTPyiVELyTEuTacmE';

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
}

async function getAuthUser(request: Request) {
  // 从 cookie 中获取 auth_session
  const cookieHeader = request.headers.get('cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map((c: string) => {
      const [key, ...val] = c.split('=');
      return [key, val.join('=')];
    })
  );
  const sessionId = cookies['auth_session'];
  if (!sessionId) return null;

  // 使用项目的 session 机制
  try {
    const { getSession } = await import('@/lib/auth');
    // getSession uses cookies() internally, but we can also check via the session store
    // Since we have the sessionId, let's use a direct approach
    const session = await getSession();
    if (session?.user) {
      return { id: session.user.id, role: 'admin', name: session.user.name };
    }
  } catch {
    // Fallback: check erp_user cookie (legacy)
  }

  // Legacy: check erp_user cookie
  const erpUserCookie = cookies['erp_user'];
  if (erpUserCookie) {
    try {
      return JSON.parse(decodeURIComponent(erpUserCookie));
    } catch {
      return null;
    }
  }

  return null;
}

// 生成工号: WK-YYYYMMDD-NNN
async function generateWorkerNo(): Promise<string> {
  const supabase = getSupabaseAdmin();
  const today = new Date();
  const dateStr = today.getFullYear().toString() +
    String(today.getMonth() + 1).padStart(2, '0') +
    String(today.getDate()).padStart(2, '0');
  const prefix = `WK-${dateStr}-`;
  const { data: existing } = await supabase
    .from('workers')
    .select('worker_no')
    .like('worker_no', `${prefix}%`)
    .order('worker_no', { ascending: false })
    .limit(1);
  let seq = 1;
  if (existing && existing.length > 0) {
    const lastCode = existing[0].worker_no;
    const lastSeq = parseInt(lastCode.split('-').pop() || '0', 10);
    seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

// GET - 获取工人列表
export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || '';
    const craftType = searchParams.get('craft_type') || '';
    const status = searchParams.get('status') || '';
    const workshopId = searchParams.get('workshop_id') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('page_size') || '20', 10);

    let query = supabase
      .from('workers')
      .select('*, workshops(name)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (keyword) {
      query = query.or(`name.ilike.%${keyword}%,worker_no.ilike.%${keyword}%`);
    }
    if (craftType) {
      query = query.eq('craft_type', craftType);
    }
    if (status) {
      query = query.eq('status', status);
    }
    if (workshopId) {
      query = query.eq('workshop_id', workshopId);
    }

    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);

    const { data, error, count } = await query;
    if (error) {
      console.error('获取工人列表失败:', error);
      return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 });
    }

    const workers = (data || []).map((w: Record<string, unknown>) => ({
      ...w,
      workshop_name: (w.workshops as Record<string, unknown>)?.name || null,
    }));

    return NextResponse.json({ success: true, workers, total: count || 0, page, pageSize });
  } catch (error) {
    console.error('获取工人列表失败:', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

// POST - 创建工人
export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }
    const body = await request.json();
    const { worker_no, name, phone, gender, craft_type, workshop_id, status, skill_tags, hire_date, remark } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: '姓名不能为空' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let finalWorkerNo = worker_no;
    if (!finalWorkerNo || !finalWorkerNo.trim()) {
      finalWorkerNo = await generateWorkerNo();
    } else {
      const { data: existing } = await supabase.from('workers').select('id').eq('worker_no', finalWorkerNo).maybeSingle();
      if (existing) {
        return NextResponse.json({ success: false, error: '工号已存在' }, { status: 400 });
      }
    }

    const insertData: Record<string, unknown> = {
      worker_no: finalWorkerNo,
      name: name.trim(),
      phone: phone || null,
      gender: gender || null,
      craft_type: craft_type || null,
      workshop_id: workshop_id || null,
      status: status || 'active',
      skill_tags: skill_tags || null,
      hire_date: hire_date || null,
      remark: remark || null,
      created_by: user.id,
    };

    const { data, error } = await supabase.from('workers').insert(insertData).select('*, workshops(name)').single();
    if (error) {
      console.error('创建工人失败:', error);
      if (error.code === '23505') {
        return NextResponse.json({ success: false, error: '工号已存在' }, { status: 400 });
      }
      return NextResponse.json({ success: false, error: '创建失败' }, { status: 500 });
    }

    const worker = { ...data, workshop_name: (data.workshops as Record<string, unknown>)?.name || null };
    return NextResponse.json({ success: true, worker });
  } catch (error) {
    console.error('创建工人失败:', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
