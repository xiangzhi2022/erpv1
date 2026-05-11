import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/role-access';

// GET - 获取供应商列表（支持搜索、分类筛选、评级筛选、分页）
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || '';
    const category = searchParams.get('category') || '';
    const rating = searchParams.get('rating') || '';
    const status = searchParams.get('status') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)));

    const supabase = getSupabaseClient();

    // 计算分页偏移
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('suppliers')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    // 按关键词模糊搜索（名称/联系人/电话）
    // 使用 Supabase 的 or + ilike，转义特殊字符 %
    if (keyword) {
      const escaped = keyword.replace(/%/g, '\\%').replace(/_/g, '\\_');
      query = query.or(
        `name.ilike.%${escaped}%,contact_person.ilike.%${escaped}%,phone.ilike.%${escaped}%`
      );
    }

    // 按分类筛选
    if (category) {
      query = query.eq('category', category);
    }

    // 按评级筛选
    if (rating) {
      query = query.eq('rating', rating);
    }

    // 按状态筛选
    if (status) {
      query = query.eq('status', status);
    }
    if (!isSuperAdmin(user)) {
      if (!user.tenant_id) {
        return NextResponse.json({ success: false, error: '当前用户未关联企业' }, { status: 403 });
      }
      query = query.eq('tenant_id', user.tenant_id);
    }

    const { data: suppliers, error, count } = await query;

    if (error) {
      console.error('获取供应商列表数据库错误:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: suppliers || [],
      total: count || 0,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('获取供应商列表失败:', error);
    return NextResponse.json({ success: false, error: '获取供应商列表失败' }, { status: 500 });
  }
}
