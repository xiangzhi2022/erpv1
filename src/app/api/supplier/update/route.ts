import { parseJson } from '@/lib/api/request';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Database } from '@/db/database.types';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import { createClient } from '@/lib/supabase/server';

const VALID_STATUSES = ['active', 'inspecting', 'blacklisted'] as const;
const VALID_RATINGS = ['A', 'B', 'C', 'D'] as const;
const VALID_CATEGORIES = ['原材料', '包装耗材', '外协加工', '办公设备'] as const;
const supplierUpdateSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  contactPerson: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  category: z.union([z.enum(VALID_CATEGORIES), z.literal('')]).optional(),
  rating: z.enum(VALID_RATINGS).optional(),
  status: z.enum(VALID_STATUSES).optional(),
  address: z.string().nullable().optional(),
  remark: z.string().nullable().optional(),
});

// 将空字符串转为 null，确保数据库写入一致性
function toNullIfEmpty(value: string | undefined | null): string | null {
  if (value === undefined || value === null || value.trim() === '') return null;
  return value.trim();
}

// PATCH - 更新供应商信息（支持全量编辑和快捷状态切换）
export async function PATCH(request: NextRequest) {
  try {
    const context = await getEnterpriseContext();
    requirePermission(context, 'partners.manage');

    const body = await parseJson(request, supplierUpdateSchema);
    const { id, name, contactPerson, phone, email, category, rating, status, address, remark } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ success: false, error: '缺少供应商ID' }, { status: 400 });
    }

    const supabase = await createClient();

    // 先验证供应商存在
    const { data: existing, error: fetchError } = await supabase
      .from('suppliers')
      .select('id, name, enterprise_id')
      .eq('enterprise_id', context.enterpriseId)
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ success: false, error: '供应商不存在' }, { status: 404 });
    }
    // 如果更新名称，检查是否重复
    if (name !== undefined && name !== null) {
      const trimmedName = String(name).trim();
      if (trimmedName === '') {
        return NextResponse.json({ success: false, error: '供应商名称不能为空' }, { status: 400 });
      }
      const { data: duplicate } = await supabase
        .from('suppliers')
        .select('id')
        .eq('enterprise_id', context.enterpriseId)
        .eq('name', trimmedName)
        .neq('id', id)
        .limit(1);

      if (duplicate && duplicate.length > 0) {
        return NextResponse.json({ success: false, error: '供应商名称已存在' }, { status: 400 });
      }
    }

    // 校验枚举字段
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: '无效的状态值' }, { status: 400 });
    }
    if (rating !== undefined && !VALID_RATINGS.includes(rating)) {
      return NextResponse.json({ success: false, error: '无效的评级值' }, { status: 400 });
    }
    if (category !== undefined && category !== '' && !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ success: false, error: '无效的供应类别' }, { status: 400 });
    }

    // 构建更新对象（只包含传入的字段，空字符串转 null）
    const updateData: Database['public']['Tables']['suppliers']['Update'] = {
      updated_at: new Date().toISOString(),
    };
    if (name !== undefined) updateData.name = String(name).trim();
    if (contactPerson !== undefined) updateData.contact_person = toNullIfEmpty(contactPerson);
    if (phone !== undefined) updateData.phone = toNullIfEmpty(phone);
    if (email !== undefined) updateData.email = toNullIfEmpty(email);
    if (category !== undefined) updateData.category = toNullIfEmpty(category);
    if (rating !== undefined) updateData.rating = rating;
    if (status !== undefined) updateData.status = status;
    if (address !== undefined) updateData.address = toNullIfEmpty(address);
    if (remark !== undefined) updateData.remark = toNullIfEmpty(remark);

    const { data, error } = await supabase
      .from('suppliers')
      .update(updateData)
      .eq('enterprise_id', context.enterpriseId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('更新供应商数据库错误:', error);
      return NextResponse.json({ success: false, error: '更新供应商失败' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ success: false, error: '供应商不存在或更新失败' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('更新供应商失败:', error);
    return NextResponse.json({ success: false, error: '更新供应商失败' }, { status: 500 });
  }
}
