import { z } from 'zod';
import { NextResponse } from 'next/server';
import { isApiError } from '@/lib/api/errors';
import { executeIdempotentMutation } from '@/lib/api/idempotency';
import { parseJson } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';

const reportSchema = z.object({ task_id: z.string().uuid(), action: z.enum(['start', 'complete']) });
const reportResultSchema = z.object({ status: z.enum(['processing', 'completed']), message: z.string() });
interface RpcError { code?: string; message: string; }
interface AtomicRpcClient { rpc(functionName: string, args: Record<string, unknown>): Promise<{ data: unknown; error: RpcError | null }>; }

function errorResponse(error: unknown) {
  if (isEnterpriseAccessError(error) || isApiError(error)) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  console.error('worker_report.request_failed', { error });
  return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
}

function rpcErrorResponse(error: RpcError) {
  const status = error.code === 'P0001' ? 409 : error.code === 'P0002' ? 404 : error.code === '22023' ? 422 : error.code === '28000' ? 401 : 403;
  const message = status === 409 ? '当前任务状态不允许该操作' : status === 404 ? '任务不存在或未分配给当前工人' : status === 422 ? '请求参数无法处理' : status === 401 ? '请先登录' : '无权操作此任务';
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'production.report.self');
    const input = await parseJson(request, reportSchema);
    const supabase = await createClient();
    const rpc = (functionName: string, args: Record<string, unknown>) => (supabase as unknown as AtomicRpcClient).rpc(functionName, args);
    return await executeIdempotentMutation({
      request,
      context,
      input,
      rpc,
      execute: async () => {
        const { data, error } = await rpc('report_worker_task', {
          target_enterprise_id: context.enterpriseId,
          target_task_id: input.task_id,
          target_action: input.action,
        });
        if (error) return rpcErrorResponse(error);
        const result = reportResultSchema.safeParse(data);
        if (!result.success) throw new Error('invalid_worker_report_result');
        return NextResponse.json({ success: true, message: result.data.message, status: result.data.status });
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
