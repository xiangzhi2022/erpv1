import { PATCH as approveTask } from '../approve/route';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const delegated = new Request(request.url, {
    method: 'PATCH',
    headers: request.headers,
    body: JSON.stringify({ ...body, action: 'rework' }),
  });
  return approveTask(delegated, context);
}
