import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    
    // 获取当前用户
    const userCookie = request.cookies.get('erp_user');
    if (!userCookie) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }
    
    const user = JSON.parse(userCookie.value);
    
    // 1. 检查 user_settings 表是否存在
    const { data: tables, error: tablesError } = await supabase
      .from('user_settings')
      .select('*')
      .limit(1);
    
    // 2. 尝试插入数据
    const { data, error: insertError } = await supabase
      .from('user_settings')
      .insert({
        user_id: user.id,
        setting_key: 'order_prefix',
        setting_value: 'TEST',
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    return NextResponse.json({
      success: true,
      debug: {
        userId: user.id,
        tablesError: tablesError,
        insertError: insertError,
        insertedData: data
      }
    });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
