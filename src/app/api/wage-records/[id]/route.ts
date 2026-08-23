import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isApiError } from '@/lib/api/errors';
import { executeIdempotentMutation } from '@/lib/api/idempotency';
import { parseJson, parseParams } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';

const paramsSchema = z.object({ id: z.string().uuid() });
const moneySchema = z.number().finite().nonnegative();
const mutableStatusSchema = z.enum(['pending', 'approved', 'rejected']);
const expectedStatusSchema = z.enum(['pending', 'approved', 'rejected', 'settled', 'paid']);
const updateSchema = z.object({
  expected_status: expectedStatusSchema,
  status: mutableStatusSchema.optional(),
  wage_amount: moneySchema.optional(),
  quantity: moneySchema.optional(),
  unit_price: moneySchema.optional(),
}).superRefine((input, ctx) => {
  if (input.status === undefined && input.wage_amount === undefined && input.quantity === undefined && input.unit_price === undefined) {
    ctx.addIssue({ code: 'custom', message: '没有需要更新的字段' });
  }
  if (input.expected_status === 'approved' && (input.wage_amount !== undefined || input.quantity !== undefined || input.unit_price !== undefined)) {
    ctx.addIssue({ code: 'custom', message: '已确认工资只能驳回，不能修改金额或数量' });
  }
});
interface RouteContext { params: Promise<{ id: string }>; }
interface RpcClient { rpc(functionName: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>; }
function isStatusConflict(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P0001');
}
function errorResponse(error: unknown, message: string) {
  if (isEnterpriseAccessError(error) || isApiError(error)) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  console.error('wage_record.request_failed', { error });
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}
export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'wages.manage');
    const { id } = await parseParams(params, paramsSchema);
    const input = await parseJson(request, updateSchema);
    const supabase = await createClient();
    const rpc = (functionName: string, args: Record<string, unknown>) => (supabase as unknown as RpcClient).rpc(functionName, args);
    return await executeIdempotentMutation({
      request, context, rpc,
      input: { resource_id: id, action: 'manage_wage_record', body: input },
      execute: async () => {
        const { data, error } = await supabase.rpc('finance_manage_wage_record', {
          target_enterprise_id: context.enterpriseId,
          target_record_id: id,
          target_expected_status: input.expected_status,
          target_status: input.status ?? input.expected_status,
          ...(input.wage_amount === undefined ? {} : { target_wage_amount: input.wage_amount }),
          ...(input.quantity === undefined ? {} : { target_quantity: input.quantity }),
          ...(input.unit_price === undefined ? {} : { target_unit_price: input.unit_price }),
        });
        if (error) {
          if (isStatusConflict(error)) return NextResponse.json({ success: false, error: '工资记录不存在或状态已变化' }, { status: 409 });
          throw error;
        }
        const record = data?.[0];
        if (!record) return NextResponse.json({ success: false, error: '工资记录不存在或状态已变化' }, { status: 409 });
        return NextResponse.json({ success: true, data: record });
      },
    });
  } catch (error) { return errorResponse(error, '修改工资记录失败'); }
}
