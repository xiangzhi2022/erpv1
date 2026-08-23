import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isApiError } from '@/lib/api/errors';
import { errorResponse } from '@/lib/api/response';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { createClient } from '@/lib/supabase/server';
import { UPLOADS_ALLOWED_MIME_TYPES, UPLOADS_BUCKET, UPLOADS_MAX_FILE_SIZE } from '@/lib/storage';

const ALLOWED_TYPES = new Set<string>(UPLOADS_ALLOWED_MIME_TYPES);
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
  console.error('order_attachment.upload_failed', {
    requestId: id,
    errorName: error instanceof Error ? error.name : 'NonErrorException',
  });
  return errorResponse(
    { code: 'INTERNAL_ERROR', message: '上传订单附件失败' },
    500,
    id,
  );
}

function safeExt(fileName: string, fallback: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
  return ext || fallback;
}

export async function POST(request: Request) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'attachments.manage');
    await enforceRateLimit({
      bucket: 'uploads.user',
      identifier: context.userId,
      limit: 30,
      windowSeconds: 3600,
    });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ success: false, error: '请选择文件' }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ success: false, error: '仅支持 JPG、PNG、WebP 图片或 PDF 文档' }, { status: 400 });
    }
    if (file.size > UPLOADS_MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: '文件不能超过 8MB' }, { status: 400 });
    }

    const supabase = await createClient();
    const ext = safeExt(file.name, file.type === 'application/pdf' ? 'pdf' : 'jpg');
    const filePath = `order-items/${context.enterpriseId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error } = await supabase.storage.from(UPLOADS_BUCKET).upload(filePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      console.error('upload order attachment failed:', error);
      return NextResponse.json({ success: false, error: '上传订单附件失败' }, { status: 500 });
    }

    const { data: signedUrl, error: signedUrlError } = await supabase.storage
      .from(UPLOADS_BUCKET)
      .createSignedUrl(filePath, 3600);
    if (signedUrlError) {
      return NextResponse.json({ success: false, error: '生成附件访问地址失败' }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      attachment: {
        file_name: file.name,
        file_path: filePath,
        file_url: signedUrl.signedUrl,
        file_type: file.type,
        file_size: file.size,
      },
    });
  } catch (error) {
    return uploadErrorResponse(request, error);
  }
}
