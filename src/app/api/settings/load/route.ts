import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseClient();
    
    // 获取当前用户
    const userCookie = request.cookies.get('current_user');
    if (!userCookie) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }
    
    const user = JSON.parse(userCookie.value);
    
    // 获取用户的所有设置
    const { data, error } = await supabase
      .from('user_settings')
      .select('setting_key, setting_value')
      .eq('user_id', user.id);
    
    if (error) {
      console.error('获取设置失败:', error);
      return NextResponse.json(
        { success: false, error: '获取设置失败' },
        { status: 500 }
      );
    }
    
    // 将结果转换为键值对
    const settings: Record<string, string> = {};
    if (data) {
      data.forEach((item: { setting_key: string; setting_value: string }) => {
        settings[item.setting_key] = item.setting_value;
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      settings 
    });
    
  } catch (error) {
    console.error('获取设置失败:', error);
    return NextResponse.json(
      { success: false, error: '获取设置失败' },
      { status: 500 }
    );
  }
}
