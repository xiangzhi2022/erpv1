import { z } from 'zod';
import { ApiError } from '@/lib/api/errors';
import { getEnterpriseContext, requirePermission } from '@/lib/enterprise/context';
import type { EnterpriseContext } from '@/lib/enterprise/context';
import type { EnterprisePermissionCode } from '@/lib/enterprise/permissions';
import { createClient } from '@/lib/supabase/server';

const categoryNameSchema = z.string().trim().min(1).max(100);
const categoryColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const categoryDescriptionSchema = z.string().trim().max(1000).nullable();

export const categoryParamsSchema = z.object({
  id: z.string().uuid(),
}).strict();

export const categoryCreateSchema = z.object({
  name: categoryNameSchema,
  color: categoryColorSchema.default('#6366f1'),
  description: categoryDescriptionSchema.optional(),
}).strict();

export const categoryUpdateSchema = z.object({
  name: categoryNameSchema.optional(),
  color: categoryColorSchema.optional(),
  description: categoryDescriptionSchema.optional(),
}).strict().refine((input) => Object.keys(input).length > 0, {
  message: '没有可更新的分类字段',
});

export interface CategoryDto {
  id: string;
  enterprise_id: string;
  name: string;
  color: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryServiceAccess {
  context?: EnterpriseContext;
}

type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;

const CATEGORY_SELECT = 'id, enterprise_id, name, color, description, created_at, updated_at';

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new ApiError('VALIDATION_FAILED', 422, '请求参数校验失败');
  }
  return parsed.data;
}

async function authorize(
  permission: EnterprisePermissionCode,
  access?: CategoryServiceAccess,
): Promise<EnterpriseContext> {
  const context = access?.context ?? await getEnterpriseContext();
  requirePermission(context, permission);
  return context;
}

function categoryDatabaseError(code: string, message: string): ApiError {
  return new ApiError(code, 500, message);
}

function categoryMutationError(
  error: { code?: string } | null,
  fallbackCode: string,
  fallbackMessage: string,
): ApiError {
  if (error?.code === '23505') {
    return ApiError.conflict('CATEGORY_NAME_CONFLICT', '分类名称已存在');
  }
  return categoryDatabaseError(fallbackCode, fallbackMessage);
}

export async function listCategories(
  access?: CategoryServiceAccess,
): Promise<CategoryDto[]> {
  const context = await authorize('catalog.read', access);
  const client = await createClient();
  const { data, error } = await client
    .from('categories')
    .select(CATEGORY_SELECT)
    .eq('enterprise_id', context.enterpriseId)
    .order('created_at', { ascending: true });
  if (error) throw categoryDatabaseError('CATEGORY_QUERY_FAILED', '查询分类失败');
  return (data ?? []) as CategoryDto[];
}

export async function readCategory(
  idInput: unknown,
  access?: CategoryServiceAccess,
): Promise<CategoryDto> {
  const context = await authorize('catalog.read', access);
  const { id } = parseInput(categoryParamsSchema, { id: idInput });
  const client = await createClient();
  const { data, error } = await client
    .from('categories')
    .select(CATEGORY_SELECT)
    .eq('enterprise_id', context.enterpriseId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw categoryDatabaseError('CATEGORY_QUERY_FAILED', '查询分类失败');
  if (!data) throw ApiError.notFound('CATEGORY_NOT_FOUND', '分类不存在');
  return data as CategoryDto;
}

export async function insertCategory(
  inputValue: unknown,
  access?: CategoryServiceAccess,
): Promise<CategoryDto> {
  const context = await authorize('catalog.manage', access);
  const input: CategoryCreateInput = parseInput(categoryCreateSchema, inputValue);
  const client = await createClient();
  const { data, error } = await client
    .from('categories')
    .insert({
      enterprise_id: context.enterpriseId,
      name: input.name,
      color: input.color,
      description: input.description ?? null,
    })
    .select(CATEGORY_SELECT)
    .single();
  if (error || !data) {
    throw categoryMutationError(error, 'CATEGORY_CREATE_FAILED', '创建分类失败');
  }
  return data as CategoryDto;
}

export async function editCategory(
  idInput: unknown,
  inputValue: unknown,
  access?: CategoryServiceAccess,
): Promise<CategoryDto> {
  const context = await authorize('catalog.manage', access);
  const { id } = parseInput(categoryParamsSchema, { id: idInput });
  const input: CategoryUpdateInput = parseInput(categoryUpdateSchema, inputValue);
  const client = await createClient();
  const { data, error } = await client
    .from('categories')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('enterprise_id', context.enterpriseId)
    .eq('id', id)
    .select(CATEGORY_SELECT)
    .maybeSingle();
  if (error) throw categoryMutationError(error, 'CATEGORY_UPDATE_FAILED', '更新分类失败');
  if (!data) throw ApiError.notFound('CATEGORY_NOT_FOUND', '分类不存在');
  return data as CategoryDto;
}

export async function removeCategory(
  idInput: unknown,
  access?: CategoryServiceAccess,
): Promise<void> {
  const context = await authorize('catalog.manage', access);
  const { id } = parseInput(categoryParamsSchema, { id: idInput });
  const client = await createClient();
  const { data, error } = await client
    .from('categories')
    .delete()
    .eq('enterprise_id', context.enterpriseId)
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error?.code === '23503') {
    throw ApiError.conflict('CATEGORY_IN_USE', '分类正在使用中，无法删除');
  }
  if (error) throw categoryDatabaseError('CATEGORY_DELETE_FAILED', '删除分类失败');
  if (!data) throw ApiError.notFound('CATEGORY_NOT_FOUND', '分类不存在');
}
