import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    // 获取当前用户
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('erp_user');
    
    if (!userCookie) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }
    
    const user = JSON.parse(userCookie.value);
    const { prefix, companyName, phone, address } = await request.json();
    const now = new Date().toISOString();
    
    const url = process.env.COZE_SUPABASE_URL;
    const serviceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      return NextResponse.json(
        { success: false, error: '服务器配置错误' },
        { status: 500 }
      );
    }

    // 要保存的设置
    const settings = [
      { key: 'order_prefix', value: prefix || '' },
      { key: 'company_name', value: companyName || '' },
      { key: 'company_phone', value: phone || '' },
      { key: 'company_address', value: address || '' }
    ];

    // 使用 REST API 直接操作数据库（Service Role Key 绕过 RLS）
    for (const setting of settings) {
      const recordId = `${user.id}-${setting.key}`;
      
      // 先删除旧记录
      await fetch(`${url}/rest/v1/user_settings?user_id=eq.${user.id}&setting_key=eq.${setting.key}`, {
        method: 'DELETE',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`
        }
      });

      // 插入新记录（只有值不为空才插入）
      if (setting.value) {
        await fetch(`${url}/rest/v1/user_settings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`
          },
          body: JSON.stringify({
            id: recordId,
            user_id: user.id,
            setting_key: setting.key,
            setting_value: setting.value,
            created_at: now,
            updated_at: now
          })
        });
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
