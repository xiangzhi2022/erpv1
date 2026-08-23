import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isApiError } from '@/lib/api/errors';
import { executeIdempotentMutation } from '@/lib/api/idempotency';
import { parseJson, parseParams } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';

const paramsSchema = z.object({ id: z.string().uuid() });
const taskTypeSchema = z.enum(['board', 'door', 'special', 'hardware', 'process', 'install', 'package', 'delivery']);
const calculationSchema = z.enum(['by_piece', 'by_area', 'by_meter', 'by_set', 'fixed']);
const scopeSchema = z.enum(['company', 'position', 'worker']);
const moneySchema = z.number().finite().nonnegative();
const updateSchema = z.object({
  rule_name: z.string().trim().min(1).max(200).optional(), process_name: z.string().trim().max(200).nullable().optional(), unit: z.string().trim().min(1).max(32).optional(),
  unit_price: moneySchema.optional(), role_scope: z.string().trim().max(200).nullable().optional(), enabled: z.boolean().optional(), product_type: z.string().trim().max(100).nullable().optional(),
  extra_amount: moneySchema.optional(), task_type: taskTypeSchema.optional(), calculation_method: calculationSchema.optional(), scope_type: scopeSchema.optional(),
  worker_id: z.string().uuid().nullable().optional(), position_id: z.string().uuid().nullable().optional(),
}).refine((input) => Object.keys(input).length > 0, '没有需要更新的字段');
interface RouteContext { params: Promise<{ id: string }>; }
interface RpcClient { rpc(functionName: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>; }

function errorResponse(error: unknown, message: string) {
  if (isEnterpriseAccessError(error) || isApiError(error)) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  console.error('wage_rule.request_failed', { error });
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'wages.manage');
    requirePermission(context, 'wages.read.all');
    const { id } = await parseParams(params, paramsSchema);
    const input = await parseJson(request, updateSchema);
    const supabase = await createClient();
    const rpc = (functionName: string, args: Record<string, unknown>) => (supabase as unknown as RpcClient).rpc(functionName, args);
    return await executeIdempotentMutation({
      request, context, rpc,
      input: { resource_id: id, action: 'update_wage_rule', body: input },
      execute: async () => {
        const { data: existing, error: existingError } = await supabase.from('wage_rules').select('scope_type,worker_id,position_id').eq('enterprise_id', context.enterpriseId).eq('id', id).maybeSingle();
        if (existingError) throw existingError;
        if (!existing) return NextResponse.json({ success: false, error: '工资规则不存在' }, { status: 404 });
        const scopeType = input.scope_type ?? existing.scope_type;
        const workerId = input.scope_type === 'worker' ? input.worker_id : input.worker_id ?? existing.worker_id;
        const positionId = input.scope_type === 'position' ? input.position_id : input.position_id ?? existing.position_id;
        if (scopeType === 'worker' && !workerId) return NextResponse.json({ success: false, error: '个人规则必须选择工人' }, { status: 422 });
        if (scopeType === 'position' && !positionId) return NextResponse.json({ success: false, error: '岗位规则必须选择岗位' }, { status: 422 });
        if (scopeType === 'worker' && workerId) {
          const { data, error } = await supabase.from('workers').select('id').eq('enterprise_id', context.enterpriseId).eq('id', workerId).maybeSingle();
          if (error) throw error;
          if (!data) return NextResponse.json({ success: false, error: '适用工人不属于当前企业' }, { status: 422 });
        }
        if (scopeType === 'position' && positionId) {
          const { data, error } = await supabase.from('positions').select('id').eq('enterprise_id', context.enterpriseId).eq('id', positionId).maybeSingle();
          if (error) throw error;
          if (!data) return NextResponse.json({ success: false, error: '适用岗位不属于当前企业' }, { status: 422 });
        }
        const { data, error } = await supabase.from('wage_rules').update({
          ...input, scope_type: scopeType, worker_id: scopeType === 'worker' ? workerId : null, position_id: scopeType === 'position' ? positionId : null, updated_at: new Date().toISOString(),
        }).eq('enterprise_id', context.enterpriseId).eq('id', id).select().maybeSingle();
        if (error) throw error;
        if (!data) return NextResponse.json({ success: false, error: '工资规则不存在' }, { status: 404 });
        return NextResponse.json({ success: true, data });
      },
    });
  } catch (error) { return errorResponse(error, '修改工资管理规则失败'); }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'wages.manage');
    requirePermission(context, 'wages.read.all');
    const { id } = await parseParams(params, paramsSchema);
    const supabase = await createClient();
    const rpc = (functionName: string, args: Record<string, unknown>) => (supabase as unknown as RpcClient).rpc(functionName, args);
    return await executeIdempotentMutation({
      request, context, rpc,
      input: { resource_id: id, action: 'delete_wage_rule', body: {} },
      execute: async () => {
        const { data, error } = await supabase.from('wage_rules').delete().eq('enterprise_id', context.enterpriseId).eq('id', id).select('id').maybeSingle();
        if (error) throw error;
        if (!data) return NextResponse.json({ success: false, error: '工资规则不存在' }, { status: 404 });
        return NextResponse.json({ success: true });
      },
    });
  } catch (error) { return errorResponse(error, '删除工资管理规则失败'); }
}
