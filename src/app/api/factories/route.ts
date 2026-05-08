import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest, type AuthUser } from '@/lib/auth';

interface FactoryConfigRow {
  current_load: number | null;
  max_load: number | null;
  is_accepting: boolean | null;
  avg_completion_days: number | null;
}

interface TenantRow {
  id: string;
  name: string | null;
  type: string | null;
  address: string | null;
  status: string | null;
  code?: string | null;
  order_prefix?: string | null;
  factory_config: FactoryConfigRow[] | null;
}

interface FactoryItem {
  id: string;
  name: string | null;
  code: string | null;
  address: string | null;
  order_prefix: string | null;
  current_load: number;
  max_load: number;
  is_accepting: boolean;
  avg_completion_days: number;
  load_percentage: number;
}

// GET /api/factories - Factory tenant list for order form & factory selection
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    // Dealers, factory admins, and super admins can view factory list
    const allowedRoles = ['dealer_admin', 'factory_admin', 'super_admin'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ success: false, error: '无权限访问' }, { status: 403 });
    }

    const supabase = getSupabaseClient();

    // Use left join on factory_config so factories without config still appear
    const { data: factories, error } = await supabase
      .from('tenants')
      .select(`
        id, name, type, address, status,
        factory_config:factory_config(current_load, max_load, is_accepting, avg_completion_days)
      `)
      .eq('type', 'factory')
      .eq('status', 'active');

    if (error) {
      console.error('获取工厂列表失败:', error);
      return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 });
    }

    const factoryList: FactoryItem[] = (factories || []).map((f: TenantRow) => {
      const config = f.factory_config?.[0] ?? null;
      const currentLoad = config?.current_load ?? 0;
      const maxLoad = config?.max_load ?? 100;
      const isAccepting = config?.is_accepting ?? true;
      const avgCompletionDays = config?.avg_completion_days ?? 15;

      // Guard against division by zero
      const loadPercentage = maxLoad > 0
        ? Math.round((currentLoad / maxLoad) * 100)
        : 0;

      return {
        id: f.id,
        name: f.name,
        code: f.code ?? null,
        address: f.address,
        order_prefix: f.order_prefix ?? null,
        current_load: currentLoad,
        max_load: maxLoad,
        is_accepting: isAccepting,
        avg_completion_days: avgCompletionDays,
        load_percentage: loadPercentage,
      };
    });

    // Sort by load percentage ascending (smart recommendation)
    factoryList.sort((a, b) => a.load_percentage - b.load_percentage);

    return NextResponse.json({
      success: true,
      data: factoryList,
    });
  } catch (error) {
    console.error('获取工厂列表失败:', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
