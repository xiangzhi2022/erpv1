import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { authFailed, requireSettingsUser } from '../_utils';

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;

    const formData = await request.formData();
    const file = formData.get('avatar') as File | null;
    if (!file) return NextResponse.json({ success: false, error: '???????' }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, error: '??? JPG?PNG?WebP ??' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: '?????????? 2MB' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `avatars/${auth.user.id}/${Date.now()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage.from('uploads').upload(fileName, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    });

    if (uploadError) return NextResponse.json({ success: false, error: '??????' }, { status: 500 });

    const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
    return NextResponse.json({ success: true, avatarUrl: urlData?.publicUrl || '' });
  } catch (error) {
    console.error('upload avatar failed:', error);
    return NextResponse.json({ success: false, error: '??????' }, { status: 500 });
  }
}
