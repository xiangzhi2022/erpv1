import { z } from 'zod';
import { NextResponse } from 'next/server';
import { isApiError } from '@/lib/api/errors';
import { executeIdempotentMutation } from '@/lib/api/idempotency';
import { parseJson, parseQuery } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';

const statusSchema = z.enum(['pending', 'scheduling', 'producing', 'inspecting', 'stored', 'aborted']);
const prioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);
const querySchema = z.object({
  status: statusSchema.optional(), workshop_id: z.string().uuid().optional(), priority: prioritySchema.optional(),
  keyword: z.string().trim().max(64).regex(/^[\p{L}\p{N} -]+$/u, '关键词包含不支持的字符').optional(),
  page: z.coerce.number().int().min(1).default(1), page_size: z.coerce.number().int().min(1).max(100).default(20),
});
const createSchema = z.object({
  order_id: z.string().uuid().nullable().optional(), workshop_id: z.string().uuid().nullable().optional(),
  product_name: z.string().trim().min(1).max(200), target_quantity: z.coerce.number().int().positive(),
  priority: prioritySchema.default('normal'), expected_end_date: z.string().datetime().nullable().optional(), remark: z.string().trim().max(500).nullable().optional(),
});
const createResultSchema = z.object({
  id: z.string().uuid(), order_id: z.string().uuid().nullable(), workshop_id: z.string().uuid().nullable(),
  product_name: z.string(), target_quantity: z.number(), completed_quantity: z.number(), status: z.literal('pending'), priority: prioritySchema,
  expected_end_date: z.string().nullable(), remark: z.string().nullable(),
});
interface RpcError { code?: string; message: string; }
interface RpcClient { rpc(functionName: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: RpcError | null }>; }
function errorResponse(error: unknown, message: string) {
  if (isEnterpriseAccessError(error) || isApiError(error)) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  console.error('progress_work_orders.request_failed', { error });
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}

function createRpcErrorResponse(error: RpcError) {
  const status = error.code === 'P0002' ? 404 : error.code === '22023' ? 422 : error.code === '28000' ? 401 : 403;
  const message = status === 404 ? '订单不存在' : status === 422 ? '请求参数无法处理' : status === 401 ? '请先登录' : '无权创建工单';
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(request: Request) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'production.read');
    const filters = parseQuery(request, querySchema);
    const supabase = await createClient();
    let query = supabase.from('work_orders').select('id,order_id,workshop_id,product_name,target_quantity,completed_quantity,status,priority,start_date,expected_end_date,actual_end_date,remark,created_at,updated_at', { count: 'exact' })
      .eq('enterprise_id', context.enterpriseId).order('created_at', { ascending: false }).range((filters.page - 1) * filters.page_size, filters.page * filters.page_size - 1);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.workshop_id) query = query.eq('workshop_id', filters.workshop_id);
    if (filters.priority) query = query.eq('priority', filters.priority);
    const { data, error, count } = await query;
    if (error) throw error;
    const workOrders = (data ?? []).filter((workOrder) => !filters.keyword || workOrder.product_name.toLowerCase().includes(filters.keyword.toLowerCase()));
    const { data: statRows, error: statError } = await supabase.from('work_orders').select('status,expected_end_date')
      .eq('enterprise_id', context.enterpriseId);
    if (statError) throw statError;
    const now = Date.now(); const all = statRows ?? [];
    return NextResponse.json({ success: true, data: workOrders, stats: {
      total: all.length, pending: all.filter((row) => row.status === 'pending').length, producing: all.filter((row) => row.status === 'producing').length,
      inspecting: all.filter((row) => row.status === 'inspecting').length, stored: all.filter((row) => row.status === 'stored').length,
      aborted: all.filter((row) => row.status === 'aborted').length,
      overdue: all.filter((row) => Boolean(row.expected_end_date) && !['stored', 'aborted'].includes(row.status) && new Date(row.expected_end_date!).getTime() < now).length,
    }, pagination: { page: filters.page, page_size: filters.page_size, total: count ?? 0 } });
  } catch (error) { return errorResponse(error, '获取工单失败'); }
}

export async function POST(request: Request) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'production.plan');
    const input = await parseJson(request, createSchema);
    const supabase = await createClient();
    const rpc = (functionName: string, args: Record<string, unknown>) => (supabase as unknown as RpcClient).rpc(functionName, args);
    return await executeIdempotentMutation({
      request,
      context,
      input: { action: 'create_work_order', ...input },
      rpc,
      execute: async () => {
        const { data, error } = await (supabase as unknown as RpcClient).rpc('create_production_work_order', {
          target_enterprise_id: context.enterpriseId,
          target_order_id: input.order_id ?? null,
          target_workshop_id: input.workshop_id ?? null,
          target_product_name: input.product_name,
          target_quantity: input.target_quantity,
          target_priority: input.priority,
          target_expected_end_date: input.expected_end_date ?? null,
          target_remark: input.remark ?? null,
        });
        if (error) return createRpcErrorResponse(error);
        const result = createResultSchema.safeParse(data);
        if (!result.success) throw new Error('invalid_work_order_create_result');
        return NextResponse.json({ success: true, data: result.data }, { status: 201 });
      },
    });
  } catch (error) { return errorResponse(error, '创建工单失败'); }
}
