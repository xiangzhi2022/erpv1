import { z } from 'zod';
import { ApiError, type ApiFieldErrors } from './errors';

export type RouteParams =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>
  | undefined;

const jsonObjectSchema = z.record(z.string(), z.unknown());

function fieldErrors(error: z.ZodError): ApiFieldErrors {
  const flattened = z.flattenError(error);
  const result: ApiFieldErrors = {};
  for (const [field, messages] of Object.entries(
    flattened.fieldErrors as Record<string, string[] | undefined>,
  )) {
    if (messages && messages.length > 0) result[field] = messages;
  }
  if (flattened.formErrors.length > 0) result._root = flattened.formErrors;
  return result;
}

function parseWithSchema<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new ApiError(
      'VALIDATION_FAILED',
      422,
      '请求参数校验失败',
      fieldErrors(parsed.error),
    );
  }
  return parsed.data;
}

export async function parseJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let input: unknown;
  try {
    const text = await request.text();
    if (!text.trim()) throw new SyntaxError('empty body');
    input = JSON.parse(text) as unknown;
  } catch {
    throw new ApiError('INVALID_JSON', 400, '请求内容必须是有效 JSON');
  }
  return parseWithSchema(schema, input);
}

export function parseJsonObject(request: Request): Promise<Record<string, unknown>> {
  return parseJson(request, jsonObjectSchema);
}

export function parseQuery<T>(request: Request, schema: z.ZodType<T>): T {
  const url = new URL(request.url);
  const input: Record<string, string | string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    input[key] = values.length > 1 ? values : values[0];
  }
  return parseWithSchema(schema, input);
}

export async function parseParams<T>(params: RouteParams, schema: z.ZodType<T>): Promise<T> {
  return parseWithSchema(schema, await params ?? {});
}
