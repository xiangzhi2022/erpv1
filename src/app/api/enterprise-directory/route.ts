import { getSupabaseClient } from '@/db/client';
import { getUserFromRequest } from '@/lib/auth';
import {
  getPermissionTemplate,
  getUserPermissionKeys,
  isSuperAdmin,
  normalizeAccountRole,
  tenantTypeToBusinessType,
  type AccessUser,
} from '@/lib/role-access';

type DirectoryScope = {
  mode: 'dealer_management' | 'readonly';
  title: string;
  description: string;
  targetTenantType?: 'manufacturer' | 'material_supplier';
};

function resolveDirectoryScope(user: AccessUser): DirectoryScope | null {
  if (isSuperAdmin(user)) {
    return {
      mode: 'dealer_management',
      title: '经销商管理',
      description: '超级管理员可维护经销商档案。',
    };
  }

  const role = normalizeAccountRole(user.role);
  const tenantBusinessType = tenantTypeToBusinessType(user.tenant_type);
  const permissions = getUserPermissionKeys(user);
  const hasDealerPermission = permissions.some((key) => getPermissionTemplate(key)?.businessType === 'dealer');
  const hasFactoryPermission = permissions.some((key) => getPermissionTemplate(key)?.businessType === 'factory');

  if (role === 'dealer_admin' || tenantBusinessType === 'dealer' || hasDealerPermission) {
    return {
      mode: 'readonly',
      title: '工厂企业',
      description: '经销商只能查看已注册工厂企业信息，用于下单协作，不提供新增、编辑或删除。',
      targetTenantType: 'manufacturer',
    };
  }

  if (role === 'factory_admin' || tenantBusinessType === 'factory' || hasFactoryPermission) {
    return {
      mode: 'readonly',
      title: '材料供应商',
      description: '工厂企业只能查看已注册材料供应商信息，用于材料采购协作，不提供新增、编辑或删除。',
      targetTenantType: 'material_supplier',
    };
  }

  return null;
}

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return Response.json({ success: false, error: '请先登录' }, { status: 401 });
    }

    const scope = resolveDirectoryScope(user);
    if (!scope) {
      return Response.json({ success: false, error: '当前账号无企业库访问权限' }, { status: 403 });
    }

    if (scope.mode === 'dealer_management') {
      return Response.json({ success: true, ...scope, data: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } });
    }

    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword')?.trim() || '';
    const status = searchParams.get('status')?.trim() || '';
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(searchParams.get('pageSize') || '10', 10)));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = getSupabaseClient()
      .from('tenants')
      .select('id, name, company_name, tenant_type, contact_person, contact_phone, address, status, created_at, updated_at', { count: 'exact' })
      .eq('tenant_type', scope.targetTenantType)
      .order('created_at', { ascending: false });

    if (keyword) {
      const safeKeyword = escapeLike(keyword);
      query = query.or(`name.ilike.%${safeKeyword}%,company_name.ilike.%${safeKeyword}%,contact_person.ilike.%${safeKeyword}%,contact_phone.ilike.%${safeKeyword}%`);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query.range(from, to);
    if (error) {
      return Response.json({ success: false, error: error.message }, { status: 500 });
    }

    return Response.json({
      success: true,
      ...scope,
      readonly: true,
      data: data || [],
      pagination: {
        page,
        pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
      },
    });
  } catch (error) {
    console.error('enterprise directory error:', error);
    return Response.json({ success: false, error: '服务端错误' }, { status: 500 });
  }
}
