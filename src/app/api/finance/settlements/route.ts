import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isApiError } from '@/lib/api/errors';
import { parseJson } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';

const createSettlementSchema = z.object({ record_ids: z.array(z.string().uuid()).min(1).max(100) })
  .refine((input) => new Set(input.record_ids).size === input.record_ids.length, {
    path: ['record_ids'], message: '工资记录不能重复',
  });

function isStatusConflict(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P0001');
}

function errorResponse(error: unknown, message: string) {
  if (isEnterpriseAccessError(error) || isApiError(error)) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  console.error('finance_settlements.request_failed', { error });
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}

export async function GET() {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'finance.read');
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('finance_list_settlements', {
      target_enterprise_id: context.enterpriseId,
    });
    if (error) throw error;
    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error) { return errorResponse(error, '获取结算记录失败'); }
}

export async function POST(request: Request) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'wages.settle');
    const { record_ids: recordIds } = await parseJson(request, createSettlementSchema);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('finance_settle_wage_records', {
      target_enterprise_id: context.enterpriseId,
      target_record_ids: recordIds,
    });
    if (error) {
      if (isStatusConflict(error)) return NextResponse.json({ success: false, error: '部分工资记录状态已变化' }, { status: 409 });
      throw error;
    }
    if (!data || data.length !== recordIds.length) return NextResponse.json({ success: false, error: '部分工资记录状态已变化' }, { status: 409 });
    return NextResponse.json({ success: true, data });
  } catch (error) { return errorResponse(error, '创建结算失败'); }
}
