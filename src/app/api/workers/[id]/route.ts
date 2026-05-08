import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSession } from '@/lib/auth';

const supabaseUrl = process.env.COZE_SUPABASE_URL || 'https://cdcnjtgabgjkouavwxsl.supabase.co';
const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkY25qdGdhYmdqa291YXZ3eHNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzg1MjM0MSwiZXhwIjoyMDkzNDI4MzQxfQ.LzvwvnkQx_lIjIjsZd8FxyXRaDwTPyiVELyTEuTacmE';

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
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

    const updateData: Record<string, unknown> = {};
    const allowedFields = ['name', 'phone', 'gender', 'craft_type', 'workshop_id', 'status', 'skill_tags', 'hire_date', 'remark'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: '没有需要更新的字段' }, { status: 400 });
    }
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from('workers').update(updateData).eq('id', id).select('*, workshops(name)').single();
    if (error) {
      console.error('更新工人失败:', error);
      return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 });
    }
    if (!data) return NextResponse.json({ success: false, error: '工人不存在' }, { status: 404 });
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
