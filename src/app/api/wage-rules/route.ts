import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isApiError } from '@/lib/api/errors';
import { executeIdempotentMutation } from '@/lib/api/idempotency';
import { parseJson, parseQuery } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';

const taskTypeSchema = z.enum(['board', 'door', 'special', 'hardware', 'process', 'install', 'package', 'delivery']);
const calculationSchema = z.enum(['by_piece', 'by_area', 'by_meter', 'by_set', 'fixed']);
const scopeSchema = z.enum(['company', 'position', 'worker']);
const moneySchema = z.number().finite().nonnegative();
const querySchema = z.object({ task_type: taskTypeSchema.optional(), scope_type: scopeSchema.optional(), include_options: z.enum(['0', '1']).optional() });
const createSchema = z.object({
  rule_name: z.string().trim().min(1).max(200), task_type: taskTypeSchema,
  process_name: z.string().trim().max(200).nullable().optional(), unit: z.string().trim().min(1).max(32).default('件'),
  unit_price: moneySchema.default(0), calculation_method: calculationSchema.optional(), role_scope: z.string().trim().max(200).nullable().optional(),
  scope_type: scopeSchema.default('company'), worker_id: z.string().uuid().nullable().optional(), position_id: z.string().uuid().nullable().optional(),
  product_type: z.string().trim().max(100).nullable().optional(), extra_amount: moneySchema.default(0), enabled: z.boolean().default(true),
}).superRefine((input, ctx) => {
  if (input.scope_type === 'worker' && !input.worker_id) ctx.addIssue({ code: 'custom', path: ['worker_id'], message: '个人规则必须选择工人' });
  if (input.scope_type === 'position' && !input.position_id) ctx.addIssue({ code: 'custom', path: ['position_id'], message: '岗位规则必须选择岗位' });
});
interface RpcClient { rpc(functionName: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>; }

async function scopeReferencesExist(supabase: Awaited<ReturnType<typeof createClient>>, enterpriseId: string, scopeType: z.infer<typeof scopeSchema>, workerId: string | null | undefined, positionId: string | null | undefined) {
  if (scopeType === 'worker' && workerId) {
    const { data, error } = await supabase.from('workers').select('id').eq('enterprise_id', enterpriseId).eq('id', workerId).maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }
  if (scopeType === 'position' && positionId) {
    const { data, error } = await supabase.from('positions').select('id').eq('enterprise_id', enterpriseId).eq('id', positionId).maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }
  return true;
}

function errorResponse(error: unknown, message: string) {
  if (isEnterpriseAccessError(error) || isApiError(error)) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  console.error('wage_rules.request_failed', { error });
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'wages.read.all');
    const filters = parseQuery(request, querySchema);
    const supabase = await createClient();
    let query = supabase.from('wage_rules').select('*').eq('enterprise_id', context.enterpriseId).order('created_at', { ascending: false });
    if (filters.task_type) query = query.eq('task_type', filters.task_type);
    if (filters.scope_type) query = query.eq('scope_type', filters.scope_type);
    const { data, error } = await query;
    if (error) throw error;
    const options = filters.include_options === '1' ? await Promise.all([
      supabase.from('workers').select('id,name,worker_no,craft_type').eq('enterprise_id', context.enterpriseId).order('name', { ascending: true }),
      supabase.from('positions').select('id,name,code,position_type').eq('enterprise_id', context.enterpriseId).order('name', { ascending: true }),
    ]) : null;
    if (options?.some((result) => result.error)) throw options.find((result) => result.error)?.error;
    return NextResponse.json({ success: true, data: data ?? [], options: options ? { workers: options[0].data ?? [], positions: options[1].data ?? [] } : undefined });
  } catch (error) { return errorResponse(error, '获取工资管理规则失败'); }
}

export async function POST(request: Request) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'wages.manage');
    requirePermission(context, 'wages.read.all');
    const input = await parseJson(request, createSchema);
    const supabase = await createClient();
    const rpc = (functionName: string, args: Record<string, unknown>) => (supabase as unknown as RpcClient).rpc(functionName, args);
    return await executeIdempotentMutation({
      request, context, rpc,
      input: { action: 'create_wage_rule', body: input },
      execute: async () => {
        if (!await scopeReferencesExist(supabase, context.enterpriseId, input.scope_type, input.worker_id, input.position_id)) {
          return NextResponse.json({ success: false, error: '适用的工人或岗位不属于当前企业' }, { status: 422 });
        }
        const { data, error } = await supabase.from('wage_rules').insert({
          enterprise_id: context.enterpriseId, rule_name: input.rule_name, task_type: input.task_type, process_name: input.process_name ?? null,
          unit: input.unit, unit_price: input.unit_price, calculation_method: input.calculation_method ?? 'by_piece', role_scope: input.role_scope ?? null,
          scope_type: input.scope_type, worker_id: input.scope_type === 'worker' ? input.worker_id : null, position_id: input.scope_type === 'position' ? input.position_id : null,
          product_type: input.product_type ?? null, extra_amount: input.extra_amount, enabled: input.enabled, created_by: context.userId, updated_at: new Date().toISOString(),
        }).select().single();
        if (error) throw error;
        return NextResponse.json({ success: true, data }, { status: 201 });
      },
    });
  } catch (error) { return errorResponse(error, '创建工资管理规则失败'); }
}
