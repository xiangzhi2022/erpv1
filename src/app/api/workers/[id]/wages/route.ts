import { z } from 'zod';
import { NextResponse } from 'next/server';
import { isApiError } from '@/lib/api/errors';
import { parseParams } from '@/lib/api/request';
import { getEnterpriseContext, hasEnterprisePermission, requirePermission } from '@/lib/enterprise/context';
import { EnterpriseAccessError, isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';

const paramsSchema = z.object({ id: z.string().uuid() });
function errorResponse(error: unknown) {
  if (isEnterpriseAccessError(error) || isApiError(error)) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  console.error('worker_wages.request_failed', { error });
  return NextResponse.json({ success: false, error: '获取工人工资失败' }, { status: 500 });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'wages.read.all');
    if (!hasEnterprisePermission(context, 'wages.read.all')) {
      throw new EnterpriseAccessError('ENTERPRISE_PERMISSION_DENIED', 403, '没有执行该操作的权限');
    }
    const { id } = await parseParams(params, paramsSchema);
    const supabase = await createClient();
    const { data: worker, error: workerError } = await supabase.from('workers').select('id,worker_no,name,status,workshop_id')
      .eq('enterprise_id', context.enterpriseId).eq('id', id).maybeSingle();
    if (workerError) throw workerError;
    if (!worker) return NextResponse.json({ success: false, error: '工人不存在' }, { status: 404 });
    const { data, error } = await supabase.from('worker_wage_records')
      .select('id,task_id,order_id,product_id,space_id,quantity,unit_price,wage_amount,status,submitted_at,approved_at,paid_at,created_at,updated_at')
      .eq('enterprise_id', context.enterpriseId).eq('worker_id', worker.id).order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ success: true, worker, data: data ?? [] });
  } catch (error) { return errorResponse(error); }
}
