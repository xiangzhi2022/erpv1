import { ApiError } from '@/lib/api/errors';
import { withApiHandler, type ApiHandlerContext } from '@/lib/api/handler';
import { parseJson, parseParams } from '@/lib/api/request';
import { apiSuccess } from '@/lib/api/response';
import { taskIdSchema, taskMutationSchema } from '@/lib/tasks/schemas';
import { deleteTask, getTaskById, toggleTask, updateTask } from '@/app/actions/tasks';

export const GET = withApiHandler(
  { policy: 'enterprise' },
  async ({ params }) => {
    const { id } = await parseParams(params, taskIdSchema);
    const task = await getTaskById(id);
    if (!task) throw ApiError.notFound('TASK_NOT_FOUND', '任务不存在');
    return apiSuccess(task);
  },
);

async function mutateTask({ request, params }: ApiHandlerContext) {
  const { id } = await parseParams(params, taskIdSchema);
  const input = await parseJson(request, taskMutationSchema);
  return apiSuccess('action' in input ? await toggleTask(id) : await updateTask(id, input));
}

export const PATCH = withApiHandler({ policy: 'enterprise' }, mutateTask);
export const PUT = withApiHandler({ policy: 'enterprise' }, mutateTask);

export const DELETE = withApiHandler(
  { policy: 'enterprise' },
  async ({ params }) => {
    const { id } = await parseParams(params, taskIdSchema);
    await deleteTask(id);
    return apiSuccess({ deleted: true });
  },
);
