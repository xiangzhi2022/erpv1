import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isApiError } from '@/lib/api/errors';
import { parseJson } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { calculateTaskWage } from '@/lib/four-level-order';

const amountSchema = z.number().finite().nonnegative();
const taskSchema = z.object({
  quantity: amountSchema.optional(), area: amountSchema.optional(), length: amountSchema.optional(), width: amountSchema.optional(), meter_count: amountSchema.optional(),
  task_type: z.enum(['board', 'door', 'special', 'hardware', 'process', 'install', 'package', 'delivery']).optional(), product_type: z.string().trim().max(100).optional(),
}).default({});
const ruleSchema = z.object({
  unit_price: amountSchema.default(0), extra_amount: amountSchema.default(0), calculation_method: z.enum(['by_piece', 'by_area', 'by_meter', 'by_set', 'fixed']).optional(),
  task_type: z.enum(['board', 'door', 'special', 'hardware', 'process', 'install', 'package', 'delivery']).optional(),
}).default({ unit_price: 0, extra_amount: 0 });
const calculateSchema = z.object({ task: taskSchema.optional(), wageRule: ruleSchema.optional(), wage_rule: ruleSchema.optional() })
  .refine((input) => input.wageRule || input.wage_rule, { message: '工资规则不能为空', path: ['wageRule'] });

function errorResponse(error: unknown) {
  if (isEnterpriseAccessError(error) || isApiError(error)) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  console.error('wage_calculation.request_failed', { error });
  return NextResponse.json({ success: false, error: '计算工资失败' }, { status: 500 });
}

export async function POST(request: Request) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'wages.manage');
    const input = await parseJson(request, calculateSchema);
    const amount = calculateTaskWage(input.task ?? {}, input.wageRule ?? input.wage_rule);
    return NextResponse.json({ success: true, data: { wage_amount: amount } });
  } catch (error) { return errorResponse(error); }
}
