import { getUserFromRequest } from '@/lib/auth';
import { calculateTaskWage, canViewWageSummary } from '@/lib/four-level-order';

function jsonError(error: string, status: number) {
  return Response.json({ success: false, error }, { status });
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return jsonError('请先登录', 401);
    if (!canViewWageSummary(user)) return jsonError('无权计算工资', 403);
    const body = (await request.json()) as Record<string, unknown>;
    const amount = calculateTaskWage(
      (body.task || {}) as { quantity?: number | string; area?: number | string; length?: number | string; meter_count?: number | string },
      (body.wageRule || body.wage_rule || {}) as { unit_price?: number | string; calculation_method?: string }
    );
    return Response.json({ success: true, data: { wage_amount: amount } });
  } catch (error) {
    console.error('calculate wage failed:', error);
    return jsonError('计算工资失败', 500);
  }
}
