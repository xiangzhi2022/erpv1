import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';

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
  contact_person: string | null;
  contact_phone: string | null;
  address: string | null;
  status: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  factory_config?: FactoryConfigRow[] | null;
}

interface FactoryLoad {
  total_orders: number;
  producing_orders: number;
}

// GET /api/factories - Factory tenant list for order form, order assignment, and factory portal selection
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const allowedRoles = ['dealer_admin', 'factory_admin', 'super_admin', 'saas_admin'];
    if (!allowedRoles.includes(user.role)) {
      return NextResponse.json({ success: false, error: '无权限访问' }, { status: 403 });
    }

    const supabase = getSupabaseClient();

    const { data: factories, error } = await supabase
      .from('tenants')
      .select(`
        id, name, type, contact_person, contact_phone, address, status, created_at, updated_at,
        factory_config:factory_config(current_load, max_load, is_accepting, avg_completion_days)
      `)
      .eq('type', 'factory')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('获取工厂列表失败:', error);
      return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 });
    }

    const factoryRows = (factories || []) as TenantRow[];
    const factoryIds = factoryRows.map((factory) => factory.id);
    const factoryLoadMap = new Map<string, FactoryLoad>();

    if (factoryIds.length > 0) {
      const { data: orderCounts, error: orderError } = await supabase
        .from('orders')
        .select('target_factory_id, status')
        .in('target_factory_id', factoryIds);

      if (orderError) {
        console.warn('获取工厂负载失败，使用配置负载或空负载:', orderError);
      }

      (orderCounts || []).forEach((order: Record<string, unknown>) => {
        const factoryId = String(order.target_factory_id || '');
        if (!factoryId) return;
        const load = factoryLoadMap.get(factoryId) || { total_orders: 0, producing_orders: 0 };
        load.total_orders += 1;
        if (order.status === 'producing' || order.status === 'in_production') {
          load.producing_orders += 1;
        }
        factoryLoadMap.set(factoryId, load);
      });
    }

    const factoryList = factoryRows
      .map((factory) => {
        const config = factory.factory_config?.[0] ?? null;
        const orderLoad = factoryLoadMap.get(factory.id) || { total_orders: 0, producing_orders: 0 };
        const currentLoad = config?.current_load ?? orderLoad.producing_orders;
        const maxLoad = config?.max_load ?? 100;
        const loadPercentage = maxLoad > 0 ? Math.round((currentLoad / maxLoad) * 100) : 0;

        return {
          id: factory.id,
          name: factory.name,
          type: factory.type,
          code: null,
          order_prefix: null,
          contact_person: factory.contact_person,
          contact_phone: factory.contact_phone,
          address: factory.address,
          status: factory.status,
          created_at: factory.created_at || null,
          updated_at: factory.updated_at || null,
          current_load: currentLoad,
          max_load: maxLoad,
          is_accepting: config?.is_accepting ?? true,
          avg_completion_days: config?.avg_completion_days ?? 15,
          load_percentage: loadPercentage,
          total_orders: orderLoad.total_orders,
          producing_orders: orderLoad.producing_orders,
        };
      })
      .sort((a, b) => a.load_percentage - b.load_percentage || a.producing_orders - b.producing_orders);

    return NextResponse.json({
      success: true,
      data: factoryList,
      factories: factoryList,
    });
  } catch (error) {
    console.error('获取工厂列表失败:', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
