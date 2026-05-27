import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canAccessPath } from '@/lib/role-access';
import { UPLOADS_ALLOWED_MIME_TYPES, UPLOADS_BUCKET, UPLOADS_MAX_FILE_SIZE, ensureUploadsBucket } from '@/lib/storage';

const ALLOWED_TYPES = new Set<string>(UPLOADS_ALLOWED_MIME_TYPES);

function safeExt(fileName: string, fallback: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
  return ext || fallback;
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    if (!canAccessPath(user, '/orders')) {
      return NextResponse.json({ success: false, error: '无权限上传订单附件' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ success: false, error: '请选择文件' }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ success: false, error: '仅支持 JPG、PNG、WebP 图片或 PDF 文档' }, { status: 400 });
    }
    if (file.size > UPLOADS_MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: '文件不能超过 8MB' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const bucketError = await ensureUploadsBucket(supabase);
    if (bucketError) {
      return NextResponse.json({ success: false, error: `初始化上传空间失败：${bucketError}` }, { status: 500 });
    }

    const ext = safeExt(file.name, file.type === 'application/pdf' ? 'pdf' : 'jpg');
    const tenantPart = user.tenant_id || user.id;
    const filePath = `order-items/${tenantPart}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error } = await supabase.storage.from(UPLOADS_BUCKET).upload(filePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      console.error('upload order attachment failed:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const { data: publicUrl } = supabase.storage.from(UPLOADS_BUCKET).getPublicUrl(filePath);
    return NextResponse.json({
      success: true,
      attachment: {
        file_name: file.name,
        file_path: filePath,
        file_url: publicUrl.publicUrl,
        file_type: file.type,
        file_size: file.size,
      },
    });
  } catch (error) {
    console.error('upload order attachment failed:', error);
    return NextResponse.json({ success: false, error: '上传订单附件失败' }, { status: 500 });
  }
}
