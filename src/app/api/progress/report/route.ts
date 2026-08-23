import { z } from 'zod';
import { NextResponse } from 'next/server';
import { isApiError } from '@/lib/api/errors';
import { parseJson } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';

const actions = ['start', 'complete_cutting', 'complete_assembly', 'complete_painting', 'quality_check', 'warehouse_in', 'report_progress', 'report_defect', 'pause', 'resume', 'abort'] as const;
const reportSchema = z.object({ work_order_id: z.string().uuid(), action: z.enum(actions), completed_delta: z.coerce.number().int().min(0).default(0), remark: z.string().trim().max(500).nullable().optional() });
const reportResultSchema = z.object({ work_order: z.object({ id: z.string().uuid(), status: z.string(), completed_quantity: z.number() }), log: z.object({ id: z.string().uuid() }).passthrough().nullable() });
interface RpcError { code?: string; message: string; }
interface AtomicRpcClient { rpc(functionName: string, args: Record<string, unknown>): Promise<{ data: unknown; error: RpcError | null }>; }
function errorResponse(error: unknown) {
  if (isEnterpriseAccessError(error) || isApiError(error)) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  console.error('progress_report.request_failed', { error });
  return NextResponse.json({ success: false, error: '进度上报失败' }, { status: 500 });
}

function rpcErrorResponse(error: RpcError) {
  const status = error.code === 'P0001' ? 409 : error.code === 'P0002' ? 404 : error.code === '22023' ? 422 : error.code === '28000' ? 401 : 403;
  const message = status === 409 ? '当前工单状态不允许进度上报' : status === 404 ? '工单不存在' : status === 422 ? '请求参数无法处理' : status === 401 ? '请先登录' : '无权操作该工单';
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'production.report.self');
    const input = await parseJson(request, reportSchema);
    const supabase = await createClient();
    const { data, error } = await (supabase as unknown as AtomicRpcClient).rpc('report_work_order_progress', {
      target_enterprise_id: context.enterpriseId,
      target_work_order_id: input.work_order_id,
      target_action: input.action,
      target_completed_delta: input.completed_delta,
      target_remark: input.remark ?? null,
    });
    if (error) return rpcErrorResponse(error);
    const result = reportResultSchema.safeParse(data);
    if (!result.success) throw new Error('invalid_work_order_report_result');
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) { return errorResponse(error); }
}
