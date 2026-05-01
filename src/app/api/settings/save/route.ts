import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST(request: NextRequest) {
  try {
    const { prefix, companyName, phone, address } = await request.json();
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
    
    // 保存前缀设置
    const { error: prefixError } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        setting_key: 'order_prefix',
        setting_value: prefix,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,setting_key'
      });
    
    if (prefixError) {
      console.error('保存前缀设置失败:', prefixError);
      return NextResponse.json(
        { success: false, error: '保存前缀设置失败' },
        { status: 500 }
      );
    }
    
    // 保存公司信息
    const companySettings = [
      { user_id: user.id, setting_key: 'company_name', setting_value: companyName },
      { user_id: user.id, setting_key: 'company_phone', setting_value: phone },
      { user_id: user.id, setting_key: 'company_address', setting_value: address }
    ];
    
    for (const setting of companySettings) {
      await supabase
        .from('user_settings')
        .upsert({
          ...setting,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,setting_key'
        });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: '设置保存成功' 
    });
    
  } catch (error) {
    console.error('保存设置失败:', error);
    return NextResponse.json(
      { success: false, error: '保存设置失败' },
      { status: 500 }
    );
  }
}
