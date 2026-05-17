import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { canManageProduction, canViewWageSummary, canOperateWorkerTask } from '@/lib/four-level-order';
import { getWorkerForUser } from '@/lib/four-level-order-server';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canManageProduction(user) && !canOperateWorkerTask(user)) return jsonError('无权查看生产任务', 403);

    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const orderId = searchParams.get('order_id');
    const spaceId = searchParams.get('space_id');
    const productId = searchParams.get('product_id');
    const workerId = searchParams.get('worker_id');
    const taskType = searchParams.get('task_type');
    const workshopId = searchParams.get('workshop_id');
    const workstationId = searchParams.get('workstation_id');
    const keyword = (searchParams.get('keyword') || '').trim().toLowerCase();
    const customer = (searchParams.get('customer') || '').trim().toLowerCase();
    const hasFuzzyFilter = Boolean(keyword || customer);
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('pageSize') || '20', 10)));

    let currentWorker: Record<string, unknown> | null = null;
    let query = supabase
      .from('production_tasks')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (!canManageProduction(user)) {
      currentWorker = await getWorkerForUser(supabase, user);
      if (!currentWorker) return Response.json({ success: true, data: [], stats: { total: 0 }, pagination: { page, pageSize, total: 0, totalPages: 0 } });
      query = query.or(`assigned_worker_id.eq.${String(currentWorker.id)},worker_id.eq.${String(currentWorker.id)}`);
    } else if (user.tenant_id) {
      query = query.eq('tenant_id', user.tenant_id);
    }
    if (status && status !== 'all') query = query.eq('status', status);
    if (orderId) query = query.eq('order_id', orderId);
    if (spaceId) query = query.eq('space_id', spaceId);
    if (productId) query = query.eq('product_id', productId);
    if (workerId && canManageProduction(user)) query = query.eq('assigned_worker_id', workerId);
    if (taskType && taskType !== 'all') query = query.eq('task_type', taskType);
    if (workshopId) query = query.eq('workshop_id', workshopId);
    if (workstationId) query = query.eq('workstation_id', workstationId);
    if (!hasFuzzyFilter) query = query.range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await query;
    if (error) return jsonError(error.message, 500);

    const taskRows = (data || []) as Record<string, unknown>[];
    const orderIds = Array.from(new Set(taskRows.map((row) => String(row.order_id || '')).filter(Boolean)));
    const spaceIds = Array.from(new Set(taskRows.map((row) => String(row.space_id || '')).filter(Boolean)));
    const productIds = Array.from(new Set(taskRows.map((row) => String(row.product_id || '')).filter(Boolean)));
    const workerIds = Array.from(new Set(taskRows.map((row) => String(row.assigned_worker_id || row.worker_id || '')).filter(Boolean)));
    const [ordersRes, spacesRes, productsRes, workersRes] = await Promise.all([
      orderIds.length ? supabase.from('orders').select('id, order_no, customer_name').in('id', orderIds) : Promise.resolve({ data: [] }),
      spaceIds.length ? supabase.from('order_spaces').select('id, space_name').in('id', spaceIds) : Promise.resolve({ data: [] }),
      productIds.length ? supabase.from('order_products').select('id, product_name').in('id', productIds) : Promise.resolve({ data: [] }),
      workerIds.length ? supabase.from('workers').select('id, name, worker_no, craft_type').in('id', workerIds) : Promise.resolve({ data: [] }),
    ]);
    const orderMap = new Map(((ordersRes.data || []) as Record<string, unknown>[]).map((row) => [String(row.id), row]));
    const spaceMap = new Map(((spacesRes.data || []) as Record<string, unknown>[]).map((row) => [String(row.id), row]));
    const productMap = new Map(((productsRes.data || []) as Record<string, unknown>[]).map((row) => [String(row.id), row]));
    const workerMap = new Map(((workersRes.data || []) as Record<string, unknown>[]).map((row) => [String(row.id), row]));

    const visibleWages = canViewWageSummary(user);
    let rows = taskRows.map((row) => {
      const workerKey = String(row.assigned_worker_id || row.worker_id || '');
      const copy: Record<string, unknown> = {
        ...row,
        order: orderMap.get(String(row.order_id || '')) || null,
        space: spaceMap.get(String(row.space_id || '')) || null,
        product: productMap.get(String(row.product_id || '')) || null,
        worker: workerMap.get(workerKey) || null,
      };
      if (visibleWages) return copy;
      delete copy.wage_rule_id;
      delete copy.estimated_wage_amount;
      delete copy.final_wage_amount;
      return copy;
    });

    if (keyword || customer) {
      rows = rows.filter((row) => {
        const order = row.order as Record<string, unknown> | null;
        const space = row.space as Record<string, unknown> | null;
        const product = row.product as Record<string, unknown> | null;
        const worker = row.worker as Record<string, unknown> | null;
        const haystack = [
          row.task_no,
          row.task_name,
          row.process_name,
          row.task_type,
          order?.order_no,
          order?.customer_name,
          space?.space_name,
          product?.product_name,
          worker?.name,
          worker?.worker_no,
        ].filter(Boolean).join(' ').toLowerCase();
        const customerText = String(order?.customer_name || '').toLowerCase();
        return (!keyword || haystack.includes(keyword)) && (!customer || customerText.includes(customer));
      });
    }

    const filteredTotal = rows.length;
    if (hasFuzzyFilter) rows = rows.slice((page - 1) * pageSize, page * pageSize);

    let statsQuery = supabase.from('production_tasks').select('status');
    if (canManageProduction(user) && user.tenant_id) statsQuery = statsQuery.eq('tenant_id', user.tenant_id);
    if (!canManageProduction(user) && currentWorker) {
      statsQuery = statsQuery.or(`assigned_worker_id.eq.${String(currentWorker.id)},worker_id.eq.${String(currentWorker.id)}`);
    }
    const statsRows = await statsQuery;
    const allRows = (statsRows.data || []) as { status: string }[];
    const stats = allRows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      acc.total = (acc.total || 0) + 1;
      return acc;
    }, { total: 0 });

    return Response.json({
      success: true,
      data: rows,
      stats,
      pagination: {
        page,
        pageSize,
        total: hasFuzzyFilter ? filteredTotal : count || 0,
        totalPages: Math.ceil((hasFuzzyFilter ? filteredTotal : count || 0) / pageSize),
      },
    });
  } catch (error) {
    console.error('get production tasks failed:', error);
    return jsonError('获取生产任务失败', 500);
  }
}
