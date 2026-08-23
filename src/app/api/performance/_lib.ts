import { isApiError } from '@/lib/api/errors';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';

export function numeric(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function performanceError(error: unknown, fallback: string): Response {
  if (isEnterpriseAccessError(error) || isApiError(error)) {
    return Response.json({ success: false, error: error.message }, { status: error.status });
  }
  console.error('performance.request_failed', { error });
  return Response.json({ success: false, error: fallback }, { status: 500 });
}
