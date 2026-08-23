import { withApiHandler } from '@/lib/api/handler';
import { parseJson } from '@/lib/api/request';
import { apiSuccess } from '@/lib/api/response';
import {
  categoryCreateSchema,
  insertCategory,
  listCategories,
} from '@/lib/categories/service';

export const GET = withApiHandler(
  { policy: 'enterprise', permission: 'catalog.read' },
  async ({ enterprise }) => apiSuccess(await listCategories({ context: enterprise })),
);

export const POST = withApiHandler(
  { policy: 'enterprise', permission: 'catalog.manage' },
  async ({ request, enterprise }) => {
    const input = await parseJson(request, categoryCreateSchema);
    return apiSuccess(await insertCategory(input, { context: enterprise }), { status: 201 });
  },
);
