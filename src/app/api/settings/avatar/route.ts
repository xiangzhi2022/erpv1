import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { isApiError } from '@/lib/api/errors';
import { errorResponse } from '@/lib/api/response';
import { requirePermission } from '@/lib/enterprise/context';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { UPLOADS_BUCKET } from '@/lib/storage';
import { authFailed, requireSettingsUser } from '../_utils';

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function requestId(request: Request): string {
  const candidate = request.headers.get('x-request-id');
  return candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();
}

function uploadErrorResponse(request: Request, error: unknown) {
  const id = requestId(request);
  if (isApiError(error)) {
    return errorResponse(error, error.status, id, error.responseHeaders);
  }
  console.error('avatar.upload_failed', {
    requestId: id,
    errorName: error instanceof Error ? error.name : 'NonErrorException',
  });
  return errorResponse(
    { code: 'INTERNAL_ERROR', message: '头像上传失败' },
    500,
    id,
  );
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSettingsUser(request);
    if (authFailed(auth)) return auth.response;
    requirePermission(auth.context, 'settings.manage');
    await enforceRateLimit({
      bucket: 'uploads.user',
      identifier: auth.user.id,
      limit: 30,
      windowSeconds: 3600,
    });

    const formData = await request.formData();
    const file = formData.get('avatar') as File | null;
    if (!file) return NextResponse.json({ success: false, error: '请选择头像文件' }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, error: '仅支持 JPG、PNG、WebP 图片' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: '头像文件不能超过 2MB' }, { status: 400 });
    }

    const supabase = await createClient();

    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `avatars/${auth.context.enterpriseId}/${auth.user.id}/${Date.now()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage.from(UPLOADS_BUCKET).upload(fileName, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    });

    if (uploadError) return NextResponse.json({ success: false, error: '头像上传失败' }, { status: 500 });

    const { data: urlData } = supabase.storage.from(UPLOADS_BUCKET).getPublicUrl(fileName);
    const avatarUrl = urlData?.publicUrl || '';
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('enterprise_id', auth.context.enterpriseId)
      .eq('id', auth.user.id);
    if (profileError) return NextResponse.json({ success: false, error: '保存头像失败' }, { status: 500 });
    return NextResponse.json({ success: true, avatarUrl });
  } catch (error) {
    return uploadErrorResponse(request, error);
  }
}
