import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { isApiError } from '@/lib/api/errors';
import { parseJson, parseQuery } from '@/lib/api/request';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';

const statusSchema = z.enum(['normal', 'maintenance', 'stopped']);
const filterSchema = z.object({
  status: z.union([statusSchema, z.literal('all')]).optional(),
  keyword: z.string().trim().max(64)
    .regex(/^[\p{L}\p{N}\s_-]+$/u, '关键词包含不支持的字符')
    .optional(),
});
const createWorkshopSchema = z.object({
  factory_code: z.string().trim().regex(/^[A-Za-z]+-[A-Za-z0-9]+$/),
  name: z.string().trim().min(1).max(100),
  location: z.string().trim().max(200).nullable().optional(),
  manager: z.string().trim().max(100).nullable().optional(),
  capacity: z.coerce.number().int().nonnegative().default(0),
  current_load: z.coerce.number().int().nonnegative().default(0),
  status: statusSchema.default('normal'),
  description: z.string().trim().max(1000).nullable().optional(),
}).refine((input) => input.current_load <= input.capacity, {
  message: '当前负荷不能超过产能',
  path: ['current_load'],
});

function calcLoadPercentage(currentLoad: number, capacity: number): number {
  if (capacity <= 0) return 0;
  return Math.min(Math.round((currentLoad / capacity) * 100), 100);
}

function errorResponse(error: unknown, message: string) {
  if (isEnterpriseAccessError(error) || isApiError(error)) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  console.error('factory_workshops.request_failed', { error });
  return NextResponse.json({ success: false, error: message }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'production.read');
    const filters = parseQuery(request, filterSchema);
    const supabase = await createClient();
    let query = supabase
      .from('factory_workshops')
      .select('id,factory_code,name,location,manager,capacity,current_load,status,description,created_at,updated_at')
      .eq('enterprise_id', context.enterpriseId)
      .order('created_at', { ascending: true });
    if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
    if (filters.keyword) {
      const pattern = `%${filters.keyword}%`;
      query = query.or(`name.ilike.${pattern},factory_code.ilike.${pattern},manager.ilike.${pattern},location.ilike.${pattern}`);
    }
    const { data, error } = await query;
    if (error) throw error;
    const workshops = (data ?? []).map((workshop) => ({
      ...workshop,
      load_percentage: calcLoadPercentage(workshop.current_load, workshop.capacity),
    }));
    return NextResponse.json({
      success: true,
      workshops,
      stats: {
        total: workshops.length,
        normal: workshops.filter((workshop) => workshop.status === 'normal').length,
        maintenance: workshops.filter((workshop) => workshop.status === 'maintenance').length,
        stopped: workshops.filter((workshop) => workshop.status === 'stopped').length,
        totalCapacity: workshops.reduce((sum, workshop) => sum + workshop.capacity, 0),
        totalLoad: workshops.reduce((sum, workshop) => sum + workshop.current_load, 0),
      },
    });
  } catch (error) {
    return errorResponse(error, '获取车间列表失败');
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'production.manage');
    const input = await parseJson(request, createWorkshopSchema);
    const supabase = await createClient();
    const { data: duplicate, error: duplicateError } = await supabase
      .from('factory_workshops')
      .select('id')
      .eq('enterprise_id', context.enterpriseId)
      .eq('factory_code', input.factory_code)
      .maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate) {
      return NextResponse.json({ success: false, error: '该车间编号已存在' }, { status: 409 });
    }
    const { data, error } = await supabase
      .from('factory_workshops')
      .insert({
        enterprise_id: context.enterpriseId,
        factory_code: input.factory_code,
        name: input.name,
        location: input.location || null,
        manager: input.manager || null,
        capacity: input.capacity,
        current_load: input.current_load,
        status: input.status,
        description: input.description || null,
      })
      .select('id,factory_code,name,location,manager,capacity,current_load,status,description,created_at,updated_at')
      .single();
    if (error || !data) throw error ?? new Error('Missing inserted workshop');
    return NextResponse.json({
      success: true,
      workshop: {
        ...data,
        load_percentage: calcLoadPercentage(data.current_load, data.capacity),
      },
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error, '创建车间失败');
  }
}
