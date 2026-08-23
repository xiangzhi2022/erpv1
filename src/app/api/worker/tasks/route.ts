import { NextResponse } from 'next/server';
import { isApiError } from '@/lib/api/errors';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';

function errorResponse(error: unknown) {
  if (isEnterpriseAccessError(error) || isApiError(error)) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  console.error('worker_tasks.request_failed', { error });
  return NextResponse.json({ success: false, error: '获取任务失败' }, { status: 500 });
}

export async function GET() {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'production.read');
    const supabase = await createClient();
    const { data: worker, error: workerError } = await supabase.from('workers').select('id')
      .eq('enterprise_id', context.enterpriseId).eq('user_id', context.userId).maybeSingle();
    if (workerError) throw workerError;
    if (!worker) return NextResponse.json({ success: true, tasks: [], stats: { pending: 0, processing: 0, completed: 0, total: 0 } });
    const { data, error } = await supabase.from('production_tasks')
      .select('id,order_id,product_name,quantity,completed,status,workshop_id,start_date,end_date,created_at,order:orders!inner(id,order_no,customer_name)')
      .eq('enterprise_id', context.enterpriseId).or(`assigned_worker_id.eq.${worker.id},worker_id.eq.${worker.id}`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const tasks = (data ?? []).map((task) => ({
      id: task.id, order_id: task.order_id, product_name: task.product_name, quantity: task.quantity, completed: task.completed,
      status: ['pending', 'processing', 'completed'].includes(task.status) ? task.status : 'pending', workshop_id: task.workshop_id,
      order_no: task.order?.order_no ?? '', start_date: task.start_date, end_date: task.end_date, created_at: task.created_at,
    }));
    return NextResponse.json({ success: true, tasks, stats: {
      pending: tasks.filter((task) => task.status === 'pending').length,
      processing: tasks.filter((task) => task.status === 'processing').length,
      completed: tasks.filter((task) => task.status === 'completed').length,
      total: tasks.length,
    } });
  } catch (error) { return errorResponse(error); }
}
