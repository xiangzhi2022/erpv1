import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/db/database.types';

export type ProductionTaskRpc =
  | 'assign_production_task'
  | 'transition_own_production_task'
  | 'review_production_task'
  | 'edit_production_task';

interface ProductionRpcError {
  code: string | null;
}

interface ProductionRpcClient {
  rpc(name: ProductionTaskRpc, args: Record<string, unknown>): Promise<{
    data: unknown;
    error: ProductionRpcError | null;
  }>;
}

export function callProductionTaskRpc(
  client: SupabaseClient<Database>,
  name: ProductionTaskRpc,
  args: Record<string, unknown>,
) {
  return (client as unknown as ProductionRpcClient).rpc(name, args);
}

export function productionRpcError(error: ProductionRpcError, fallback: string) {
  if (error.code === 'P0001') return { status: 409, error: '任务状态已变更，请刷新后重试' };
  if (error.code === 'P0002') return { status: 404, error: '生产任务或工人不存在' };
  if (error.code === '42501') return { status: 403, error: '没有执行该操作的权限' };
  if (error.code === '22023') return { status: 422, error: '请求参数校验失败' };
  return { status: 500, error: fallback };
}
