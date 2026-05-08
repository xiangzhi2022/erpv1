import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { cookies } from 'next/headers';
import { passwordSchema } from '@/app/settings/schemas';

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

// PUT - 修改密码
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = passwordSchema.safeParse(body);

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        { success: false, error: firstIssue?.message || '表单验证失败' },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parsed.data;
    const supabase = getSupabaseClient();

    // 验证当前密码
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('password')
      .eq('id', user.id)
      .single();

    if (fetchError || !userData) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
    }

    if (userData.password !== currentPassword) {
      return NextResponse.json({ success: false, error: '当前密码不正确' }, { status: 400 });
    }

    // 更新密码
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: newPassword, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (updateError) {
      console.error('修改密码失败:', updateError);
      return NextResponse.json({ success: false, error: '修改密码失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    console.error('修改密码异常:', error);
    return NextResponse.json({ success: false, error: '修改密码异常' }, { status: 500 });
  }
}
