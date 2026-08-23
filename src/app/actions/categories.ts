"use server";

import {
  editCategory,
  insertCategory,
  listCategories,
  readCategory,
  removeCategory,
  type CategoryDto,
} from '@/lib/categories/service';

// 查询所有分类
export async function getCategories(): Promise<CategoryDto[]> {
  return listCategories();
}

// 根据 ID 查询单个分类
export async function getCategoryById(id: unknown): Promise<CategoryDto> {
  return readCategory(id);
}

// 创建分类
export async function createCategory(input: unknown): Promise<CategoryDto> {
  return insertCategory(input);
}

// 更新分类
export async function updateCategory(
  id: unknown,
  input: unknown,
): Promise<CategoryDto> {
  return editCategory(id, input);
}

// 删除分类
export async function deleteCategory(id: unknown): Promise<void> {
  return removeCategory(id);
}
