import { z } from 'zod';
import { isApiError } from '@/lib/api/errors';
import { parseQuery } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';

const taskQuerySchema = z.object({
  status: z.string().trim().min(1).max(64).optional(),
  order_id: z.string().uuid().optional(),
  space_id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
  worker_id: z.string().uuid().optional(),
  task_type: z.string().trim().min(1).max(64).optional(),
  workshop_id: z.string().uuid().optional(),
  workstation_id: z.string().uuid().optional(),
  keyword: z.string().trim().min(1).max(120).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

const TASK_SELECT = 'id,order_id,space_id,product_id,task_no,task_name,task_code,task_type,product_name,quantity,unit,length,width,thickness,area,material,color,process_name,status,progress,priority,workshop_id,workstation_id,remark,planned_start_date,planned_end_date,started_at,submitted_at,completed_at,created_at,updated_at,assigned_worker_id,worker_id';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

function errorResponse(error: unknown) {
  if (isEnterpriseAccessError(error) || isApiError(error)) return jsonError(error.message, error.status);
  console.error('production_tasks.list_failed', { error });
  return jsonError('获取生产任务失败', 500);
}

function isSelfOnly(grants: ReadonlySet<string>) {
  return !['production.plan', 'production.assign', 'production.review', 'production.manage']
    .some((permission) => grants.has(permission));
}

export async function GET(request: Request) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'production.read');
    const filters = parseQuery(request, taskQuerySchema);
    const supabase = await createClient();

    let workerId: string | null = null;
    if (isSelfOnly(context.grants)) {
      const { data: worker, error } = await supabase
        .from('workers')
        .select('id')
        .eq('enterprise_id', context.enterpriseId)
        .eq('user_id', context.userId)
        .eq('status', 'active')
        .maybeSingle();
      if (error) {
        console.error('production_tasks.worker_lookup_failed', { code: error.code });
        return jsonError('获取生产任务失败', 500);
      }
      if (!worker) return Response.json({ success: true, data: [], stats: { total: 0 }, pagination: { page: filters.page, pageSize: filters.pageSize, total: 0, totalPages: 0 } });
      workerId = worker.id;
    }

    let query = supabase
      .from('production_tasks')
      .select(TASK_SELECT, { count: 'exact' })
      .eq('enterprise_id', context.enterpriseId)
      .order('created_at', { ascending: false });
    if (workerId) query = query.or(`assigned_worker_id.eq.${workerId},worker_id.eq.${workerId}`);
    if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
    if (filters.order_id) query = query.eq('order_id', filters.order_id);
    if (filters.space_id) query = query.eq('space_id', filters.space_id);
    if (filters.product_id) query = query.eq('product_id', filters.product_id);
    if (filters.worker_id && !workerId) query = query.eq('assigned_worker_id', filters.worker_id);
    if (filters.task_type && filters.task_type !== 'all') query = query.eq('task_type', filters.task_type);
    if (filters.workshop_id) query = query.eq('workshop_id', filters.workshop_id);
    if (filters.workstation_id) query = query.eq('workstation_id', filters.workstation_id);
    const { data, error, count } = await query.range((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize - 1);
    if (error) {
      console.error('production_tasks.query_failed', { code: error.code });
      return jsonError('获取生产任务失败', 500);
    }

    let statsQuery = supabase.from('production_tasks').select('status').eq('enterprise_id', context.enterpriseId);
    if (workerId) statsQuery = statsQuery.or(`assigned_worker_id.eq.${workerId},worker_id.eq.${workerId}`);
    const { data: statsRows, error: statsError } = await statsQuery;
    if (statsError) {
      console.error('production_tasks.stats_failed', { code: statsError.code });
      return jsonError('获取生产任务失败', 500);
    }
    const stats = (statsRows ?? []).reduce<Record<string, number>>((acc, task) => {
      acc[task.status] = (acc[task.status] ?? 0) + 1;
      acc.total = (acc.total ?? 0) + 1;
      return acc;
    }, { total: 0 });

    const workerIds = Array.from(new Set((data ?? [])
      .map((task) => task.assigned_worker_id ?? task.worker_id)
      .filter((workerId): workerId is string => Boolean(workerId))));
    const { data: workers, error: workersError } = workerIds.length > 0
      ? await supabase.from('workers').select('id,name,worker_no')
          .eq('enterprise_id', context.enterpriseId).in('id', workerIds)
      : { data: [], error: null };
    if (workersError) {
      console.error('production_tasks.workers_failed', { code: workersError.code });
      return jsonError('获取生产任务失败', 500);
    }
    const workersById = new Map((workers ?? []).map((worker) => [worker.id, { id: worker.id, name: worker.name, worker_no: worker.worker_no }]));
    const safeTasks = (data ?? []).map(({ assigned_worker_id, worker_id, ...task }) => ({
      ...task,
      worker: workersById.get(assigned_worker_id ?? worker_id ?? '') ?? null,
    }));
    return Response.json({
      success: true,
      data: safeTasks,
      stats,
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / filters.pageSize),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
