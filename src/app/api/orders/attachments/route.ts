import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canAccessPath } from '@/lib/role-access';

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

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
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: '文件不能超过 8MB' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const ext = safeExt(file.name, file.type === 'application/pdf' ? 'pdf' : 'jpg');
    const tenantPart = user.tenant_id || user.id;
    const filePath = `order-items/${tenantPart}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error } = await supabase.storage.from('uploads').upload(filePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      console.error('upload order attachment failed:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const { data: publicUrl } = supabase.storage.from('uploads').getPublicUrl(filePath);
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
