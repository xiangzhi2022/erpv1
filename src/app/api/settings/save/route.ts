import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST(request: NextRequest) {
  try {
    const { prefix, companyName, phone, address } = await request.json();
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
    const now = new Date().toISOString();
    
    // 要保存的所有设置
    const settings = [
      { setting_key: 'order_prefix', setting_value: prefix || '' },
      { setting_key: 'company_name', setting_value: companyName || '' },
      { setting_key: 'company_phone', setting_value: phone || '' },
      { setting_key: 'company_address', setting_value: address || '' }
    ];
    
    // 保存每个设置：先删除旧记录，再插入新记录
    for (const setting of settings) {
      // 先删除旧记录
      await supabase
        .from('user_settings')
        .delete()
        .eq('user_id', user.id)
        .eq('setting_key', setting.setting_key);
      
      // 插入新记录
      const { error } = await supabase
        .from('user_settings')
        .insert({
          id: `${user.id}-${setting.setting_key}`,
          user_id: user.id,
          setting_key: setting.setting_key,
          setting_value: setting.setting_value,
          created_at: now,
          updated_at: now
        });
      
      if (error) {
        console.error(`保存设置 ${setting.setting_key} 失败:`, error);
      }
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
