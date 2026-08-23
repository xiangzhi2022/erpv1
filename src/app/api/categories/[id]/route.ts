import { withApiHandler, type ApiHandlerContext } from '@/lib/api/handler';
import { parseJson, parseParams } from '@/lib/api/request';
import { apiSuccess } from '@/lib/api/response';
import {
  categoryParamsSchema,
  categoryUpdateSchema,
  editCategory,
  readCategory,
  removeCategory,
} from '@/lib/categories/service';

export const GET = withApiHandler(
  { policy: 'enterprise', permission: 'catalog.read' },
  async ({ params, enterprise }) => {
    const { id } = await parseParams(params, categoryParamsSchema);
    return apiSuccess(await readCategory(id, { context: enterprise }));
  },
);

async function updateHandler({ request, params, enterprise }: ApiHandlerContext) {
  const { id } = await parseParams(params, categoryParamsSchema);
  const input = await parseJson(request, categoryUpdateSchema);
  return apiSuccess(await editCategory(id, input, { context: enterprise }));
}

export const PUT = withApiHandler(
  { policy: 'enterprise', permission: 'catalog.manage' },
  updateHandler,
);

export const PATCH = withApiHandler(
  { policy: 'enterprise', permission: 'catalog.manage' },
  updateHandler,
);

export const DELETE = withApiHandler(
  { policy: 'enterprise', permission: 'catalog.manage' },
  async ({ params, enterprise }) => {
    const { id } = await parseParams(params, categoryParamsSchema);
    await removeCategory(id, { context: enterprise });
    return apiSuccess({ deleted: true });
  },
);
