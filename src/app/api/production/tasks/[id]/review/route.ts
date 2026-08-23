import { z } from 'zod';
import { parseJson } from '@/lib/api/request';
import { PATCH as approveTask } from '../approve/route';

const reviewSchema = z.object({ action: z.literal('approve').optional(), remark: z.string().trim().max(2000).nullable().optional() }).strict();

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const input = await parseJson(request, reviewSchema);
  return approveTask(new Request(request.url, {
    method: 'PATCH', headers: request.headers, body: JSON.stringify({ ...input, action: 'approve' }),
  }), context);
}
