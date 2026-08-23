import { parseJsonObject } from '@/lib/api/request';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import type { EnterprisePermissionCode } from '@/lib/enterprise/permissions';

async function getAuthUser(permission: EnterprisePermissionCode) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, permission);
    return { id: context.userId, enterpriseId: context.enterpriseId };
  } catch {
    return null;
  }
}

// 生成工号: WK-YYYYMMDD-NNN
async function generateWorkerNo(): Promise<string> {
  const supabase = await createClient();
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

const VALID_STATUSES = ['active', 'inactive', 'departed'] as const;
const VALID_CRAFT_TYPES = ['cutting', 'sewing', 'qc', 'packaging', 'ironing', 'pattern', 'cutting_die', 'assembly', 'other'] as const;

// GET - 获取工人列表
export async function GET(request: Request) {
  try {
    const user = await getAuthUser('members.read');
    if (!user) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const keyword = (searchParams.get('keyword') || '').trim();
    const craftType = searchParams.get('craft_type') || '';
    const status = searchParams.get('status') || '';
    const workshopId = searchParams.get('workshop_id') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '20', 10)));

    let query = supabase
      .from('workers')
      .select('*, workshops(name)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (keyword) {
      query = query.or(`name.ilike.%${keyword}%,worker_no.ilike.%${keyword}%`);
    }
    if (craftType && (VALID_CRAFT_TYPES as readonly string[]).includes(craftType)) {
      query = query.eq('craft_type', craftType);
    }
    if (status && (VALID_STATUSES as readonly string[]).includes(status)) {
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
    const user = await getAuthUser('members.manage');
    if (!user) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }
    const body = await parseJsonObject(request);
    const { worker_no, name, phone, gender, craft_type, workshop_id, status, skill_tags, hire_date, remark } = body;

    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: '姓名不能为空' }, { status: 400 });
    }

    // 校验 status 值
    if (typeof status === 'string' && !(VALID_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ success: false, error: '无效的状态值' }, { status: 400 });
    }

    // 校验 craft_type 值
    if (typeof craft_type === 'string' && !(VALID_CRAFT_TYPES as readonly string[]).includes(craft_type)) {
      return NextResponse.json({ success: false, error: '无效的工种值' }, { status: 400 });
    }

    const supabase = await createClient();
    let finalWorkerNo = typeof worker_no === 'string' ? worker_no : '';
    if (!finalWorkerNo.trim()) {
      finalWorkerNo = await generateWorkerNo();
    } else {
      const { data: existing } = await supabase.from('workers').select('id').eq('worker_no', finalWorkerNo).maybeSingle();
      if (existing) {
        return NextResponse.json({ success: false, error: '工号已存在' }, { status: 400 });
      }
    }

    const insertData = {
      enterprise_id: user.enterpriseId,
      worker_no: finalWorkerNo,
      name: name.trim(),
      phone: typeof phone === 'string' && phone ? phone : null,
      gender: typeof gender === 'string' && gender ? gender : null,
      craft_type: typeof craft_type === 'string' && craft_type ? craft_type : null,
      workshop_id: typeof workshop_id === 'string' && workshop_id ? workshop_id : null,
      status: typeof status === 'string' && status ? status : 'active',
      skill_tags: typeof skill_tags === 'string' && skill_tags ? skill_tags : null,
      hire_date: typeof hire_date === 'string' && hire_date ? hire_date : null,
      remark: typeof remark === 'string' && remark ? remark : null,
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
