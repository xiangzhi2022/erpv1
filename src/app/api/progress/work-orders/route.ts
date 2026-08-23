import { z } from 'zod';
import { NextResponse } from 'next/server';
import { isApiError } from '@/lib/api/errors';
import { parseJson, parseQuery } from '@/lib/api/request';
import { canAccessEnterpriseWorkshop, getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
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
function errorResponse(error: unknown, message: string) {
  if (isEnterpriseAccessError(error) || isApiError(error)) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  console.error('progress_work_orders.request_failed', { error });
  return NextResponse.json({ success: false, error: message }, { status: 500 });
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
    if (input.workshop_id && !canAccessEnterpriseWorkshop(context, 'production.plan', input.workshop_id)) {
      return NextResponse.json({ success: false, error: '无权在该车间创建工单' }, { status: 403 });
    }
    const supabase = await createClient();
    if (input.order_id) {
      const { data: order, error: orderError } = await supabase.from('orders').select('id').eq('enterprise_id', context.enterpriseId).eq('id', input.order_id).maybeSingle();
      if (orderError) throw orderError;
      if (!order) return NextResponse.json({ success: false, error: '订单不存在' }, { status: 404 });
    }
    const { data, error } = await supabase.from('work_orders').insert({ enterprise_id: context.enterpriseId, order_id: input.order_id ?? null, workshop_id: input.workshop_id ?? null, product_name: input.product_name, target_quantity: input.target_quantity, completed_quantity: 0, status: 'pending', priority: input.priority, expected_end_date: input.expected_end_date ?? null, remark: input.remark ?? null })
      .select('id,order_id,workshop_id,product_name,target_quantity,completed_quantity,status,priority,start_date,expected_end_date,actual_end_date,remark,created_at,updated_at').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('missing_work_order');
    const { error: logError } = await supabase.from('progress_logs').insert({ enterprise_id: context.enterpriseId, work_order_id: data.id, operator_id: context.userId, operator_name: context.displayName, action: 'start', completed_delta: 0, remark: '工单创建' });
    if (logError) throw logError;
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) { return errorResponse(error, '创建工单失败'); }
}
