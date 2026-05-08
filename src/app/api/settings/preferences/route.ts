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

// GET - 获取用户偏好设置
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('user_settings')
      .select('setting_key, setting_value')
      .eq('user_id', user.id);

    if (error) {
      console.error('获取偏好设置失败:', error);
      return NextResponse.json({ success: false, error: '获取偏好设置失败' }, { status: 500 });
    }

    const preferences: Record<string, string> = {};
    if (data) {
      data.forEach((item: { setting_key: string; setting_value: string }) => {
        preferences[item.setting_key] = item.setting_value;
      });
    }

    return NextResponse.json({ success: true, preferences });
  } catch (error) {
    console.error('获取偏好设置异常:', error);
    return NextResponse.json({ success: false, error: '获取偏好设置异常' }, { status: 500 });
  }
}

// PUT - 更新用户偏好设置
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ success: false, error: '参数不完整' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // 使用 upsert 更新或插入偏好设置
    const { error } = await supabase
      .from('user_settings')
      .upsert(
        {
          user_id: user.id,
          setting_key: key,
          setting_value: value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,setting_key' }
      );

    if (error) {
      console.error('更新偏好设置失败:', error);
      return NextResponse.json({ success: false, error: '更新偏好设置失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '偏好设置已更新' });
  } catch (error) {
    console.error('更新偏好设置异常:', error);
    return NextResponse.json({ success: false, error: '更新偏好设置异常' }, { status: 500 });
  }
}
