import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isApiError } from '@/lib/api/errors';
import { parseQuery } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';

const wageStatusSchema = z.enum(['pending', 'approved', 'rejected', 'settled', 'paid']);
const querySchema = z.object({ worker_id: z.string().uuid().optional(), status: z.union([wageStatusSchema, z.literal('all')]).optional() });
function numberValue(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
function errorResponse(error: unknown, message: string) {
  if (isEnterpriseAccessError(error) || isApiError(error)) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  console.error('finance_wages.request_failed', { error });
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}
export async function GET(request: Request) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'finance.read');
    const filters = parseQuery(request, querySchema);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('finance_list_wages', {
      target_enterprise_id: context.enterpriseId,
      ...(filters.status && filters.status !== 'all' ? { target_status: filters.status } : {}),
      ...(filters.worker_id === undefined ? {} : { target_worker_id: filters.worker_id }),
    });
    if (error) throw error;
    const rows = data ?? [];
    const summary = rows.reduce<Record<string, number>>((acc, row) => {
      const status = row.status || 'pending';
      acc[status] = (acc[status] || 0) + numberValue(row.wage_amount);
      acc.total = (acc.total || 0) + numberValue(row.wage_amount);
      acc.count = (acc.count || 0) + 1;
      return acc;
    }, { pending: 0, approved: 0, rejected: 0, settled: 0, paid: 0, total: 0, count: 0 });
    return NextResponse.json({ success: true, data: rows, summary });
  } catch (error) { return errorResponse(error, '获取工资汇总失败'); }
}
