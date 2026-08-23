import { NextRequest, NextResponse } from 'next/server';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

// GET - 获取供应商列表（支持搜索、分类筛选、评级筛选、分页）
export async function GET(request: NextRequest) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'partners.read');

    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || '';
    const category = searchParams.get('category') || '';
    const rating = searchParams.get('rating') || '';
    const status = searchParams.get('status') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)));

    const supabase = await createClient();

    // 计算分页偏移
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('suppliers')
      .select('*', { count: 'exact' })
      .eq('enterprise_id', context.enterpriseId)
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
    const { data: suppliers, error, count } = await query;

    if (error) {
      console.error('获取供应商列表数据库错误:', error);
      return NextResponse.json({ success: false, error: '获取供应商列表失败' }, { status: 500 });
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
