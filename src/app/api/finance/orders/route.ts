import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isApiError } from '@/lib/api/errors';
import { parseQuery } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';

const querySchema = z.object({ status: z.string().trim().max(64).optional() });

function errorResponse(error: unknown, message: string) {
  if (isEnterpriseAccessError(error) || isApiError(error)) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  console.error('finance_orders.request_failed', { error });
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'finance.read');
    const filters = parseQuery(request, querySchema);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('finance_list_order_summaries', {
      target_enterprise_id: context.enterpriseId,
      target_status: filters.status && filters.status !== 'all' ? filters.status : null,
    });
    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return errorResponse(error, '获取财务订单失败');
  }
}
