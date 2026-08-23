import { NextResponse } from 'next/server';
import { isApiError } from '@/lib/api/errors';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';

function errorResponse(error: unknown, message: string) {
  if (isEnterpriseAccessError(error) || isApiError(error)) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  console.error('worker_me_tasks.request_failed', { error });
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}

export async function GET() {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'production.read');
    const supabase = await createClient();
    const { data: worker, error: workerError } = await supabase.from('workers').select('id,worker_no,name,status')
      .eq('enterprise_id', context.enterpriseId).eq('user_id', context.userId).maybeSingle();
    if (workerError) throw workerError;
    if (!worker) return NextResponse.json({ success: true, worker: null, data: [], stats: { total: 0, pending: 0, producing: 0, submitted: 0, completed: 0 } });

    const { data, error } = await supabase.from('production_tasks').select('id,order_id,space_id,product_id,status,created_at,task_no,task_name,process_name,quantity,completed,workshop_id')
      .eq('enterprise_id', context.enterpriseId).or(`assigned_worker_id.eq.${worker.id},worker_id.eq.${worker.id}`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    const orderIds = [...new Set(rows.map((row) => row.order_id).filter((id): id is string => Boolean(id)))];
    const spaceIds = [...new Set(rows.map((row) => row.space_id).filter((id): id is string => Boolean(id)))];
    const productIds = [...new Set(rows.map((row) => row.product_id).filter((id): id is string => Boolean(id)))];
    const taskIds = rows.map((row) => row.id);
    const [ordersRes, spacesRes, productsRes, wagesRes] = await Promise.all([
      orderIds.length ? supabase.from('orders').select('id,order_no,customer_name').eq('enterprise_id', context.enterpriseId).in('id', orderIds) : Promise.resolve({ data: [], error: null }),
      spaceIds.length ? supabase.from('order_spaces').select('id,space_name').eq('enterprise_id', context.enterpriseId).in('id', spaceIds) : Promise.resolve({ data: [], error: null }),
      productIds.length ? supabase.from('order_products').select('id,product_name').eq('enterprise_id', context.enterpriseId).in('id', productIds) : Promise.resolve({ data: [], error: null }),
      taskIds.length ? supabase.from('worker_wage_records').select('task_id,wage_amount,status').eq('enterprise_id', context.enterpriseId).eq('worker_id', worker.id).in('task_id', taskIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (ordersRes.error || spacesRes.error || productsRes.error || wagesRes.error) throw ordersRes.error ?? spacesRes.error ?? productsRes.error ?? wagesRes.error;
    const byId = <T extends { id: string }>(items: readonly T[] | null) => new Map((items ?? []).map((item) => [item.id, item]));
    const orderMap = byId(ordersRes.data); const spaceMap = byId(spacesRes.data); const productMap = byId(productsRes.data);
    const wageMap = new Map((wagesRes.data ?? []).map((wage) => [wage.task_id, wage]));
    const stats = rows.reduce<Record<string, number>>((total, task) => ({ ...total, total: total.total + 1, [task.status]: (total[task.status] ?? 0) + 1 }), { total: 0, pending: 0, producing: 0, submitted: 0, completed: 0 });
    return NextResponse.json({ success: true, worker, data: rows.map((task) => ({ ...task, order: orderMap.get(task.order_id ?? '') ?? null, space: spaceMap.get(task.space_id ?? '') ?? null, product: productMap.get(task.product_id ?? '') ?? null, wage_record: wageMap.get(task.id) ?? null })), stats });
  } catch (error) {
    return errorResponse(error, '获取我的任务失败');
  }
}
