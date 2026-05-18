import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canOperateWorkerTask } from '@/lib/four-level-order';
import { getWorkerForUser } from '@/lib/four-level-order-server';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canOperateWorkerTask(user)) return jsonError('无权查看工人任务', 403);
    const supabase = getSupabaseClient();
    const worker = await getWorkerForUser(supabase, user);
    if (!worker) return Response.json({ success: true, worker: null, data: [], stats: { total: 0, pending: 0, producing: 0, submitted: 0, completed: 0 } });
    const { data, error } = await supabase
      .from('production_tasks')
      .select('*')
      .or(`assigned_worker_id.eq.${String(worker.id)},worker_id.eq.${String(worker.id)}`)
      .order('created_at', { ascending: false });
    if (error) return jsonError(error.message, 500);
    const rows = (data || []) as Record<string, unknown>[];
    const orderIds = Array.from(new Set(rows.map((row) => String(row.order_id || '')).filter(Boolean)));
    const spaceIds = Array.from(new Set(rows.map((row) => String(row.space_id || '')).filter(Boolean)));
    const productIds = Array.from(new Set(rows.map((row) => String(row.product_id || '')).filter(Boolean)));
    const taskIds = rows.map((row) => String(row.id)).filter(Boolean);
    const [ordersRes, spacesRes, productsRes, wagesRes] = await Promise.all([
      orderIds.length ? supabase.from('orders').select('id, order_no, customer_name').in('id', orderIds) : Promise.resolve({ data: [] }),
      spaceIds.length ? supabase.from('order_spaces').select('id, space_name').in('id', spaceIds) : Promise.resolve({ data: [] }),
      productIds.length ? supabase.from('order_products').select('id, product_name').in('id', productIds) : Promise.resolve({ data: [] }),
      taskIds.length ? supabase.from('worker_wage_records').select('id, task_id, wage_amount, status').eq('worker_id', String(worker.id)).in('task_id', taskIds) : Promise.resolve({ data: [] }),
    ]);
    const orderMap = new Map(((ordersRes.data || []) as Record<string, unknown>[]).map((row) => [String(row.id), row]));
    const spaceMap = new Map(((spacesRes.data || []) as Record<string, unknown>[]).map((row) => [String(row.id), row]));
    const productMap = new Map(((productsRes.data || []) as Record<string, unknown>[]).map((row) => [String(row.id), row]));
    const wageMap = new Map(((wagesRes.data || []) as Record<string, unknown>[]).map((row) => [String(row.task_id), row]));
    const safeRows = rows.map((row) => {
      const copy: Record<string, unknown> = {
        ...row,
        order: orderMap.get(String(row.order_id || '')) || null,
        space: spaceMap.get(String(row.space_id || '')) || null,
        product: productMap.get(String(row.product_id || '')) || null,
        wage_record: wageMap.get(String(row.id)) || null,
      };
      delete copy.wage_rule_id;
      delete copy.estimated_wage_amount;
      delete copy.final_wage_amount;
      return copy;
    });
    const stats = rows.reduce<Record<string, number>>((acc, row) => {
      const status = String(row.status || 'pending');
      acc[status] = (acc[status] || 0) + 1;
      acc.total = (acc.total || 0) + 1;
      return acc;
    }, { total: 0, pending: 0, producing: 0, submitted: 0, completed: 0 });
    return Response.json({ success: true, worker, data: safeRows, stats });
  } catch (error) {
    console.error('get my worker tasks failed:', error);
    return jsonError('获取我的任务失败', 500);
  }
}
