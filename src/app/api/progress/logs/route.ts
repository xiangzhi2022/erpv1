import { z } from 'zod';
import { NextResponse } from 'next/server';
import { isApiError } from '@/lib/api/errors';
import { parseQuery } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';

const querySchema = z.object({ work_order_id: z.string().uuid() });
function errorResponse(error: unknown) {
  if (isEnterpriseAccessError(error) || isApiError(error)) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  console.error('progress_logs.request_failed', { error });
  return NextResponse.json({ success: false, error: '获取进度日志失败' }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'production.read');
    const { work_order_id: workOrderId } = parseQuery(request, querySchema);
    const supabase = await createClient();
    const { data: workOrder, error: workOrderError } = await supabase.from('work_orders').select('id')
      .eq('enterprise_id', context.enterpriseId).eq('id', workOrderId).maybeSingle();
    if (workOrderError) throw workOrderError;
    if (!workOrder) return NextResponse.json({ success: false, error: '工单不存在' }, { status: 404 });
    const { data, error } = await supabase.from('progress_logs').select('id,work_order_id,operator_id,operator_name,action,completed_delta,remark,created_at')
      .eq('enterprise_id', context.enterpriseId).eq('work_order_id', workOrder.id).order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error) { return errorResponse(error); }
}
