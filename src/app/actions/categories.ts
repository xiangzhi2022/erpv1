"use server";

import { getSupabaseClient } from "@/db/client";
import type { Category, InsertCategory } from "@/db/schema";

// 查询所有分类
export async function getCategories(): Promise<Category[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("categories")
    .select("id, name, color, description, created_at, updated_at")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`查询分类失败: ${error.message}`);
  return (data as Category[]) ?? [];
}

// 根据 ID 查询单个分类
export async function getCategoryById(id: string): Promise<Category | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("categories")
    .select("id, name, color, description, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`查询分类失败: ${error.message}`);
  return data as Category | null;
}

// 创建分类
export async function createCategory(input: InsertCategory): Promise<Category> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("categories")
    .insert(input)
    .select("id, name, color, description, created_at, updated_at")
    .single();
  if (error) throw new Error(`创建分类失败: ${error.message}`);
  return data as Category;
}

// 更新分类
export async function updateCategory(
  id: string,
  input: Partial<InsertCategory>
): Promise<Category> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("categories")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, name, color, description, created_at, updated_at")
    .maybeSingle();
  if (error) throw new Error(`更新分类失败: ${error.message}`);
  if (!data) throw new Error("分类不存在或更新失败");
  return data as Category;
}

// 删除分类
export async function deleteCategory(id: string): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.from("categories").delete().eq("id", id);
  if (error) throw new Error(`删除分类失败: ${error.message}`);
}
