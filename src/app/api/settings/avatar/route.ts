import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { cookies } from 'next/headers';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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

// POST - 上传头像
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('avatar') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: '请选择头像文件' }, { status: 400 });
    }

    // 校验文件类型
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: '仅支持 JPG、PNG、WebP 格式' },
        { status: 400 }
      );
    }

    // 校验文件大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: '头像文件大小不能超过 2MB' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // 生成文件路径
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `avatars/${user.id}/${Date.now()}.${ext}`;

    // 上传到 Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(fileName, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('头像上传失败:', uploadError);
      return NextResponse.json({ success: false, error: '头像上传失败' }, { status: 500 });
    }

    // 获取公开 URL
    const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
    const avatarUrl = urlData?.publicUrl || '';

    // 更新用户头像
    const { error: updateError } = await supabase
      .from('users')
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (updateError) {
      console.error('更新头像URL失败:', updateError);
      return NextResponse.json({ success: false, error: '更新头像URL失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true, avatarUrl });
  } catch (error) {
    console.error('头像上传异常:', error);
    return NextResponse.json({ success: false, error: '头像上传异常' }, { status: 500 });
  }
}
