import { z } from 'zod';
import { parseJson } from '@/lib/api/request';
import { PATCH as approveTask } from '../approve/route';

const reworkSchema = z.object({ action: z.literal('rework').optional(), remark: z.string().trim().max(2000).nullable().optional() }).strict();

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const input = await parseJson(request, reworkSchema);
  return approveTask(new Request(request.url, {
    method: 'PATCH', headers: request.headers, body: JSON.stringify({ ...input, action: 'rework' }),
  }), context);
}
