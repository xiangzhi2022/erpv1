import { withApiHandler } from '@/lib/api/handler';
import { parseJson, parseQuery } from '@/lib/api/request';
import { apiSuccess } from '@/lib/api/response';
import { taskCreateSchema, taskQuerySchema } from '@/lib/tasks/schemas';
import { createTask, getTasks, getTaskStats } from '@/app/actions/tasks';

export const GET = withApiHandler(
  { policy: 'enterprise' },
  async ({ request }) => {
    const filters = parseQuery(request, taskQuerySchema);
    const [result, stats] = await Promise.all([getTasks(filters), getTaskStats()]);
    return apiSuccess(result.tasks, { meta: { total: result.total, stats } });
  },
);

export const POST = withApiHandler(
  { policy: 'enterprise' },
  async ({ request }) => {
    const input = await parseJson(request, taskCreateSchema);
    return apiSuccess(await createTask(input), { status: 201 });
  },
);
