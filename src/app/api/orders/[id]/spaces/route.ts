import { parseJsonObject } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'orders.update');

    const { id } = await params;
    const supabase = await createClient();
    const body = (await parseJsonObject(request)) as Record<string, unknown>;
    const spaceName = typeof body.space_name === 'string' ? body.space_name.trim() : '';
    if (!spaceName) return jsonError('空间名称不能为空', 400);
    const { data, error } = await supabase.rpc('create_order_space' as never, {
      target_enterprise_id: context.enterpriseId,
      target_order_id: id,
      target_space: {
        space_name: spaceName,
        space_type: typeof body.space_type === 'string' ? body.space_type.trim() || null : null,
        sort_order: typeof body.sort_order === 'number' ? body.sort_order : undefined,
        remark: typeof body.remark === 'string' ? body.remark.trim() || null : null,
      },
    } as never);
    if (error) return jsonError('新增空间失败', error.code === 'P0001' ? 409 : error.code === '42501' ? 403 : error.code === 'P0002' ? 404 : error.code === '22023' ? 422 : 500);
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('create order space failed:', error);
    return jsonError('新增空间失败', 500);
  }
}
