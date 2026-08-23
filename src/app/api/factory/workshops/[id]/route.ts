import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isApiError } from '@/lib/api/errors';
import { parseJson, parseParams } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';

const paramsSchema = z.object({ id: z.string().uuid() });
const updateWorkshopSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  location: z.string().trim().max(200).nullable().optional(),
  manager: z.string().trim().max(100).nullable().optional(),
  capacity: z.coerce.number().int().nonnegative().optional(),
  current_load: z.coerce.number().int().nonnegative().optional(),
  status: z.enum(['normal', 'maintenance', 'stopped']).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
}).refine((input) => Object.keys(input).length > 0, '没有需要更新的字段');

interface RouteContext {
  params: Promise<{ id: string }>;
}

function calcLoadPercentage(currentLoad: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Math.min(Math.round((currentLoad / capacity) * 100), 100);
}

function errorResponse(error: unknown, message: string) {
  if (isEnterpriseAccessError(error) || isApiError(error)) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  console.error('factory_workshop.request_failed', { error });
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'production.read');
    const { id } = await parseParams(params, paramsSchema);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('factory_workshops')
      .select('id,factory_code,name,location,manager,capacity,current_load,status,description,created_at,updated_at')
      .eq('enterprise_id', context.enterpriseId)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ success: false, error: '车间不存在' }, { status: 404 });
    return NextResponse.json({
      success: true,
      workshop: {
        ...data,
        load_percentage: calcLoadPercentage(data.current_load, data.capacity),
      },
    });
  } catch (error) {
    return errorResponse(error, '获取车间详情失败');
  }
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'production.manage');
    const { id } = await parseParams(params, paramsSchema);
    const input = await parseJson(request, updateWorkshopSchema);
    const supabase = await createClient();
    const { data: existing, error: existingError } = await supabase
      .from('factory_workshops')
      .select('id,capacity,current_load')
      .eq('enterprise_id', context.enterpriseId)
      .eq('id', id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) return NextResponse.json({ success: false, error: '车间不存在' }, { status: 404 });
    const finalCapacity = input.capacity ?? existing.capacity;
    const finalLoad = input.current_load ?? existing.current_load;
    if (finalLoad > finalCapacity) {
      return NextResponse.json({ success: false, error: '当前负荷不能超过产能' }, { status: 422 });
    }
    const { data, error } = await supabase
      .from('factory_workshops')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('enterprise_id', context.enterpriseId)
      .eq('id', id)
      .select('id,factory_code,name,location,manager,capacity,current_load,status,description,created_at,updated_at')
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ success: false, error: '车间不存在' }, { status: 404 });
    return NextResponse.json({
      success: true,
      workshop: {
        ...data,
        load_percentage: calcLoadPercentage(data.current_load, data.capacity),
      },
    });
  } catch (error) {
    return errorResponse(error, '更新车间失败');
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'production.manage');
    const { id } = await parseParams(params, paramsSchema);
    const supabase = await createClient();
    const { data: existing, error: existingError } = await supabase
      .from('factory_workshops')
      .select('id')
      .eq('enterprise_id', context.enterpriseId)
      .eq('id', id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) return NextResponse.json({ success: false, error: '车间不存在' }, { status: 404 });
    const { data: relatedOrder, error: relatedError } = await supabase
      .from('work_orders')
      .select('id')
      .eq('enterprise_id', context.enterpriseId)
      .eq('workshop_id', id)
      .limit(1)
      .maybeSingle();
    if (relatedError) throw relatedError;
    if (relatedOrder) {
      return NextResponse.json(
        { success: false, error: '该车间存在关联的生产工单，无法删除' },
        { status: 409 },
      );
    }
    const { error } = await supabase
      .from('factory_workshops')
      .delete()
      .eq('enterprise_id', context.enterpriseId)
      .eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, '删除车间失败');
  }
}
