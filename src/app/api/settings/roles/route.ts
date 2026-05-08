import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    
    // 测试连接
    const { data: testData, error: testError } = await supabase.from('sys_roles').select('id').limit(1);
    
    if (testError) {
      console.error('Supabase connection test error:', testError);
      return NextResponse.json({ success: false, error: testError.message }, { status: 500 });
    }
    
    const { data: roles, error } = await supabase
      .from('sys_roles')
      .select('id, role_name, dept')
      .order('sort_order');

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, roles });
  } catch (error) {
    console.error('获取角色列表失败:', error);
    return NextResponse.json({ success: false, error: '获取角色列表失败' }, { status: 500 });
  }
}
