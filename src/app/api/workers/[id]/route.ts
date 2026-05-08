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

const VALID_STATUSES = ['active', 'on_leave', 'resigned'] as const;
const VALID_CRAFT_TYPES = ['cutting', 'sewing', 'qc', 'packaging', 'ironing', 'pattern', 'cutting_die', 'assembly', 'other'] as const;

// GET - 获取单个工人详情
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('workers').select('*, workshops(name)').eq('id', id).single();
    if (error || !data) return NextResponse.json({ success: false, error: '工人不存在' }, { status: 404 });
    const worker = { ...data, workshop_name: (data.workshops as Record<string, unknown>)?.name || null };
    return NextResponse.json({ success: true, worker });
  } catch (error) {
    console.error('获取工人详情失败:', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

// PUT - 更新工人信息
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    const { id } = await params;
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    // 先校验工人是否存在
    const { data: existing, error: findError } = await supabase.from('workers').select('id').eq('id', id).maybeSingle();
    if (findError || !existing) {
      return NextResponse.json({ success: false, error: '工人不存在' }, { status: 404 });
    }

    // 校验 status 值
    if (body.status && !(VALID_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ success: false, error: '无效的状态值' }, { status: 400 });
    }

    // 校验 craft_type 值
    if (body.craft_type && !(VALID_CRAFT_TYPES as readonly string[]).includes(body.craft_type)) {
      return NextResponse.json({ success: false, error: '无效的工种值' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = ['name', 'phone', 'gender', 'craft_type', 'workshop_id', 'status', 'skill_tags', 'hire_date', 'remark'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: '没有需要更新的字段' }, { status: 400 });
    }

    // 清洗空字符串为 null
    if (updateData.phone === '') updateData.phone = null;
    if (updateData.gender === '') updateData.gender = null;
    if (updateData.craft_type === '') updateData.craft_type = null;
    if (updateData.workshop_id === '') updateData.workshop_id = null;
    if (updateData.skill_tags === '') updateData.skill_tags = null;
    if (updateData.hire_date === '') updateData.hire_date = null;
    if (updateData.remark === '') updateData.remark = null;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from('workers').update(updateData).eq('id', id).select('*, workshops(name)').single();
    if (error) {
      console.error('更新工人失败:', error);
      return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 });
    }
    const worker = { ...data, workshop_name: (data.workshops as Record<string, unknown>)?.name || null };
    return NextResponse.json({ success: true, worker });
  } catch (error) {
    console.error('更新工人失败:', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

// DELETE - 删除工人
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    // 先校验工人是否存在
    const { data: existing, error: findError } = await supabase.from('workers').select('id, name').eq('id', id).maybeSingle();
    if (findError || !existing) {
      return NextResponse.json({ success: false, error: '工人不存在' }, { status: 404 });
    }

    const { error } = await supabase.from('workers').delete().eq('id', id);
    if (error) {
      console.error('删除工人失败:', error);
      return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除工人失败:', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
