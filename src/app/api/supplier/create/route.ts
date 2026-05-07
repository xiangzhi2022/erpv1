import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.COZE_SUPABASE_URL || 'https://cdcnjtgabgjkouavwxsl.supabase.co';
const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || '';

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });
}

async function getAuthUser() {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const token = cookieStore.get('erp_user');
  if (!token) return null;
  try {
    return JSON.parse(token.value);
  } catch {
    return null;
  }
}

// 生成供应商编号: SUP-YYYYMMDD-NNN
async function generateSupplierCode(): Promise<string> {
  const supabase = getSupabaseAdmin();
  const today = new Date();
  const dateStr = today.getFullYear().toString() +
    String(today.getMonth() + 1).padStart(2, '0') +
    String(today.getDate()).padStart(2, '0');

  const prefix = `SUP-${dateStr}-`;

  const { data: existing } = await supabase
    .from('suppliers')
    .select('supplier_code')
    .like('supplier_code', `${prefix}%`)
    .order('supplier_code', { ascending: false })
    .limit(1);

  let seq = 1;
  if (existing && existing.length > 0) {
    const lastCode = existing[0].supplier_code;
    const lastSeq = parseInt(lastCode.split('-').pop() || '0', 10);
    seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(3, '0')}`;
}

// POST - 创建供应商
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { name, contactPerson, phone, email, category, rating, status, address, remark } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: '供应商名称不能为空' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 检查名称是否重复
    const { data: existing } = await supabase
      .from('suppliers')
      .select('id')
      .eq('name', name)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ success: false, error: '供应商名称已存在' }, { status: 400 });
    }

    // 自动生成编号
    const supplierCode = await generateSupplierCode();

    const { data, error } = await supabase
      .from('suppliers')
      .insert({
        supplier_code: supplierCode,
        name,
        contact_person: contactPerson || null,
        phone: phone || null,
        email: email || null,
        category: category || null,
        rating: rating || 'B',
        status: status || 'active',
        address: address || null,
        remark: remark || null,
        created_by: user.id || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('创建供应商失败:', error);
    return NextResponse.json({ success: false, error: '创建供应商失败' }, { status: 500 });
  }
}
