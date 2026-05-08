import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { cookies } from 'next/headers';
import { profileSchema } from '@/app/settings/schemas';

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

// GET - 获取当前用户资料
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const supabase = getSupabaseClient();

    // 从 users 表获取基本信息
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, phone, nickname, real_name, role, tenant_type, avatar_url, bio, created_at')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('获取用户资料失败:', userError);
      return NextResponse.json({ success: false, error: '获取用户资料失败' }, { status: 500 });
    }

    // 从 user_settings 获取偏好设置
    const { data: settingsData } = await supabase
      .from('user_settings')
      .select('setting_key, setting_value')
      .eq('user_id', user.id);

    const preferences: Record<string, string> = {};
    if (settingsData) {
      settingsData.forEach((item: { setting_key: string; setting_value: string }) => {
        preferences[item.setting_key] = item.setting_value;
      });
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: userData.id,
        phone: userData.phone,
        nickname: userData.real_name || userData.nickname || '',
        role: userData.role,
        tenantType: userData.tenant_type || '',
        avatarUrl: userData.avatar_url || '',
        bio: userData.bio || '',
        createdAt: userData.created_at,
      },
      preferences,
    });
  } catch (error) {
    console.error('获取用户资料异常:', error);
    return NextResponse.json({ success: false, error: '获取用户资料异常' }, { status: 500 });
  }
}

// PUT - 更新当前用户资料
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = profileSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        { success: false, error: firstIssue?.message || '表单验证失败' },
        { status: 400 }
      );
    }

    const { nickname, bio, avatarUrl } = parsed.data;
    const supabase = getSupabaseClient();

    // 更新 users 表（同时兼容 real_name 和 nickname）
    const updateData: Record<string, unknown> = {
      real_name: nickname,
      nickname: nickname,
      updated_at: new Date().toISOString(),
    };
    if (bio !== undefined) updateData.bio = bio;
    if (avatarUrl !== undefined) updateData.avatar_url = avatarUrl;

    const { error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', user.id);

    if (updateError) {
      console.error('更新用户资料失败:', updateError);
      return NextResponse.json({ success: false, error: '更新用户资料失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '个人资料已更新' });
  } catch (error) {
    console.error('更新用户资料异常:', error);
    return NextResponse.json({ success: false, error: '更新用户资料异常' }, { status: 500 });
  }
}
