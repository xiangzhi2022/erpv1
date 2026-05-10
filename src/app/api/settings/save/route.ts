import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { cookies } from 'next/headers';

async function getAuthUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('erp_user');
  if (!token) return null;
  try {
    return JSON.parse(token.value);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      );
    }

    const { prefix, companyName, phone, address } = await request.json();

    if (!prefix) {
      return NextResponse.json(
        { success: false, error: '前缀不能为空' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // 保存设置到 user_settings（使用 upsert）
    const settings = [
      { key: 'order_prefix', value: prefix || '' },
      { key: 'company_name', value: companyName || '' },
      { key: 'company_phone', value: phone || '' },
      { key: 'company_address', value: address || '' },
    ];

    for (const setting of settings) {
      // 只保存有值的设置项
      if (!setting.value) continue;

      const { error } = await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: user.id,
            setting_key: setting.key,
            setting_value: setting.value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,setting_key' }
        );

      if (error) {
        console.error('保存设置失败:', error);
        return NextResponse.json(
          { success: false, error: '保存设置失败' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: '设置保存成功',
    });
  } catch (error) {
    console.error('保存设置失败:', error);
    return NextResponse.json(
      { success: false, error: '保存设置失败' },
      { status: 500 }
    );
  }
}
