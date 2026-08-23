import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'roles.manage');
    const client = await createClient();
    const { data, error } = await client
      .from('permission_catalog')
      .select('code,description,created_at')
      .order('code', { ascending: true });
    if (error) {
      return Response.json({ success: false, error: '获取权限失败' }, { status: 500 });
    }
    return Response.json({
      success: true,
      data: (data ?? []).map((permission) => ({
        id: permission.code,
        code: permission.code,
        name: permission.description,
        module: permission.code.split('.')[0],
        permission_type: 'operation',
        description: permission.description,
      })),
      scope: {
        is_super_admin: false,
        tenant_id: context.enterpriseId,
        business_type: context.enterpriseType,
      },
    });
  } catch (error) {
    console.error('get permission catalog failed:', error);
    return Response.json({ success: false, error: '获取权限失败' }, { status: 500 });
  }
}
