import { NextResponse } from 'next/server';
import { isApiError } from '@/lib/api/errors';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { createClient } from '@/lib/supabase/server';

function errorResponse(error: unknown) {
  if (isEnterpriseAccessError(error) || isApiError(error)) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  console.error('progress_workshops.request_failed', { error });
  return NextResponse.json({ success: false, error: '获取车间列表失败' }, { status: 500 });
}

export async function GET() {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'production.read');
    const supabase = await createClient();
    const { data, error } = await supabase.from('work_orders').select('workshop:workshops(id,name,code)')
      .eq('enterprise_id', context.enterpriseId).order('created_at', { ascending: false });
    if (error) throw error;
    const workshops = new Map<string, { id: string; name: string; code: string }>();
    for (const row of data ?? []) {
      const workshop = row.workshop;
      if (workshop && !Array.isArray(workshop)) workshops.set(workshop.id, workshop);
    }
    return NextResponse.json({ success: true, data: [...workshops.values()].sort((left, right) => left.name.localeCompare(right.name)) });
  } catch (error) { return errorResponse(error); }
}
