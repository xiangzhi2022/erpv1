import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/db/client';
import { hashPassword } from '@/lib/auth';
import { randomUUID } from 'crypto';

type RegisterTenantType = 'manufacturer' | 'dealer' | 'material_supplier';

const tenantRoleMap: Record<RegisterTenantType, string> = {
  manufacturer: 'factory_admin',
  dealer: 'dealer_admin',
  material_supplier: 'supplier_admin',
};

const legacyTenantTypeMap: Record<RegisterTenantType, string> = {
  manufacturer: 'producer',
  dealer: 'distributor',
  material_supplier: 'supplier',
};

function normalizePrefix(value: string | undefined, fallback: string): string {
  const prefix = (value || fallback)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
  return prefix || fallback;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      phone?: string;
      password?: string;
      nickname?: string;
      companyName?: string;
      tenantType?: RegisterTenantType;
      contactPerson?: string;
      address?: string;
      prefix?: string;
    };

    const phone = body.phone?.trim() || '';
    const password = body.password || '';
    const companyName = body.companyName?.trim() || body.nickname?.trim() || '';
    const contactPerson = body.contactPerson?.trim() || body.nickname?.trim() || companyName;
    const tenantType = body.tenantType || 'manufacturer';

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return NextResponse.json({ success: false, error: '请输入正确的 11 位手机号' }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ success: false, error: '密码至少 6 位' }, { status: 400 });
    }

    if (!companyName) {
      return NextResponse.json({ success: false, error: '请输入企业名称' }, { status: 400 });
    }

    if (!tenantRoleMap[tenantType]) {
      return NextResponse.json({ success: false, error: '企业类型不正确' }, { status: 400 });
    }

    const supabase = getSupabaseServiceClient();
    const { data: existingUser, error: checkUserError } = await supabase
      .from('users')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();

    if (checkUserError) {
      return NextResponse.json({ success: false, error: '注册前检查失败' }, { status: 500 });
    }

    if (existingUser) {
      return NextResponse.json({ success: false, error: '该手机号已注册' }, { status: 400 });
    }

    const tenantId = randomUUID();
    const userId = randomUUID();
    const now = new Date().toISOString();
    const prefix = normalizePrefix(body.prefix, tenantType === 'dealer' ? 'DLR' : tenantType === 'material_supplier' ? 'SUP' : 'FAC');
    const role = tenantRoleMap[tenantType];
    const hashedPassword = hashPassword(password);

    const { error: tenantError } = await supabase.from('tenants').insert({
      id: tenantId,
      name: companyName,
      type: legacyTenantTypeMap[tenantType],
      tenant_type: tenantType,
      company_name: companyName,
      contact_person: contactPerson,
      contact_phone: phone,
      prefix,
      order_prefix: prefix,
      address: body.address?.trim() || null,
      status: 'active',
      updated_at: now,
    });

    if (tenantError) {
      console.error('create tenant failed:', tenantError);
      return NextResponse.json({ success: false, error: '企业注册失败，请稍后重试' }, { status: 500 });
    }

    const { error: userError } = await supabase.from('users').insert({
      id: userId,
      phone,
      password: hashedPassword,
      real_name: contactPerson,
      nickname: contactPerson,
      role,
      tenant_id: tenantId,
      tenant_type: tenantType,
      department: '管理',
      status: 'active',
      is_active: true,
      updated_at: now,
    });

    if (userError) {
      await supabase.from('tenants').delete().eq('id', tenantId);
      console.error('create user failed:', userError);
      return NextResponse.json({ success: false, error: '管理员账号创建失败，请稍后重试' }, { status: 500 });
    }

    await supabase.from('tenant_users').insert({
      id: randomUUID(),
      tenant_id: tenantId,
      user_id: userId,
      phone,
      password: hashedPassword,
      name: contactPerson,
      role: 'admin',
      department: '管理',
      status: 'active',
      updated_at: now,
    });

    return NextResponse.json({
      success: true,
      message: '企业注册成功',
      tenant: {
        id: tenantId,
        companyName,
        tenantType,
        prefix,
      },
      user: {
        id: userId,
        phone,
        nickname: contactPerson,
        role,
        tenantId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    console.error('register failed:', message);
    return NextResponse.json({ success: false, error: '注册失败，请稍后重试' }, { status: 500 });
  }
}
