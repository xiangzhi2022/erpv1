"use server";

import { createClient } from '@/lib/supabase/server';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import type { EnterprisePermissionCode } from '@/lib/enterprise/permissions';
import type { Category, InsertCategory } from "@/db/schema";

async function categoryAccess(permission: EnterprisePermissionCode) {
  const context = await getEnterpriseContext();
  requirePermission(context, permission);
  return { client: await createClient(), enterpriseId: context.enterpriseId };
}

// 查询所有分类
export async function getCategories(): Promise<Category[]> {
  const { client, enterpriseId } = await categoryAccess('catalog.read');
  const { data, error } = await client
    .from("categories")
    .select("id, enterprise_id, name, color, description, created_at, updated_at")
    .eq('enterprise_id', enterpriseId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`查询分类失败: ${error.message}`);
  return (data as Category[]) ?? [];
}

// 根据 ID 查询单个分类
export async function getCategoryById(id: string): Promise<Category | null> {
  const { client, enterpriseId } = await categoryAccess('catalog.read');
  const { data, error } = await client
    .from("categories")
    .select("id, enterprise_id, name, color, description, created_at, updated_at")
    .eq('enterprise_id', enterpriseId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`查询分类失败: ${error.message}`);
  return data as Category | null;
}

// 创建分类
export async function createCategory(input: InsertCategory): Promise<Category> {
  const { client, enterpriseId } = await categoryAccess('catalog.manage');
  const { data, error } = await client
    .from("categories")
    .insert({ ...input, enterprise_id: enterpriseId })
    .select("id, enterprise_id, name, color, description, created_at, updated_at")
    .single();
  if (error) throw new Error(`创建分类失败: ${error.message}`);
  return data as Category;
}

// 更新分类
export async function updateCategory(
  id: string,
  input: Partial<InsertCategory>
): Promise<Category> {
  const { client, enterpriseId } = await categoryAccess('catalog.manage');
  const { data, error } = await client
    .from("categories")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('enterprise_id', enterpriseId)
    .eq("id", id)
    .select("id, enterprise_id, name, color, description, created_at, updated_at")
    .maybeSingle();
  if (error) throw new Error(`更新分类失败: ${error.message}`);
  if (!data) throw new Error("分类不存在或更新失败");
  return data as Category;
}

// 删除分类
export async function deleteCategory(id: string): Promise<void> {
  const { client, enterpriseId } = await categoryAccess('catalog.manage');
  const { error } = await client.from("categories").delete().eq('enterprise_id', enterpriseId).eq("id", id);
  if (error) throw new Error(`删除分类失败: ${error.message}`);
}
