import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isApiError } from '@/lib/api/errors';
import { parseParams } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';

const paramsSchema = z.object({ id: z.string().uuid() });
interface RouteContext { params: Promise<{ id: string }>; }
function isStatusConflict(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P0001');
}
function errorResponse(error: unknown, message: string) {
  if (isEnterpriseAccessError(error) || isApiError(error)) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  console.error('finance_wage_payment.request_failed', { error });
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}
export async function PATCH(_request: Request, { params }: RouteContext) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'wages.settle');
    const { id } = await parseParams(params, paramsSchema);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('finance_pay_wage_record', {
      target_enterprise_id: context.enterpriseId,
      target_record_id: id,
    });
    if (error) {
      if (isStatusConflict(error)) return NextResponse.json({ success: false, error: '工资记录不存在或状态已变化' }, { status: 409 });
      throw error;
    }
    const record = data?.[0];
    if (!record) return NextResponse.json({ success: false, error: '工资记录不存在或状态已变化' }, { status: 409 });
    return NextResponse.json({ success: true, data: record });
  } catch (error) { return errorResponse(error, '工资发放失败'); }
}
