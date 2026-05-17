import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/role-access';

const getClient = () => getSupabaseClient();

// 获取经销商列表（支持分页和过滤）
export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return Response.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    if (!isSuperAdmin(user)) {
      return Response.json({ success: false, error: '无权限访问经销商管理' }, { status: 403 });
    }

    const supabase = getClient();
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || '';
    const region = searchParams.get('region') || '';
    const status = searchParams.get('status') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '10', 10)));

    let query = supabase
      .from('dealers')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // 关键字搜索（名称、联系人或电话）— 转义特殊字符防注入
    if (keyword) {
      const safe = keyword.replace(/[%_\\]/g, '\\$&');
      query = query.or(`name.ilike.%${safe}%,contact_name.ilike.%${safe}%,phone.ilike.%${safe}%`);
    }

    // 地区过滤
    if (region) {
      query = query.eq('region', region);
    }

    // 状态过滤
    if (status) {
      query = query.eq('status', status);
    }

    // 权限过滤：非管理员只能看自己创建的
    if (!isSuperAdmin(user)) {
      if (!user.tenant_id) return Response.json({ success: false, error: '当前用户未关联企业' }, { status: 403 });
      query = query.eq('tenant_id', user.tenant_id);
    }

    // 分页
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    return Response.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (err) {
    console.error('Get dealers error:', err);
    return Response.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}

// 新增经销商
export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return Response.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    if (!isSuperAdmin(user)) {
      return Response.json({ success: false, error: '无权限新增经销商' }, { status: 403 });
    }

    const body = await request.json();
    const { name, contactName, phone, region, status, remark } = body;

    if (!name || name.trim().length < 2) {
      return Response.json({ success: false, error: '经销商名称至少2个字符' }, { status: 400 });
    }

    const validStatuses = ['active', 'inactive'] as const;
    if (status && !validStatuses.includes(status)) {
      return Response.json({ success: false, error: '状态值无效，仅支持 active/inactive' }, { status: 400 });
    }

    const supabase = getClient();
    const { data, error } = await supabase
      .from('dealers')
      .insert({
        name: name.trim(),
        contact_name: contactName?.trim() || null,
        phone: phone?.trim() || null,
        region: region?.trim() || null,
        status: validStatuses.includes(status) ? status : 'active',
        remark: remark?.trim() || null,
        created_by: user.id,
        tenant_id: user.tenant_id || null,
      })
      .select()
      .single();

    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, data });
  } catch (err) {
    console.error('Create dealer error:', err);
    return Response.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
