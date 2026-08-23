import { withApiHandler } from '@/lib/api/handler';
import { parseParams } from '@/lib/api/request';
import { apiSuccess } from '@/lib/api/response';
import { notificationIdSchema } from '@/lib/tasks/schemas';
import { markNotificationRead } from '@/app/actions/tasks';

export const PATCH = withApiHandler(
  { policy: 'enterprise' },
  async ({ params }) => {
    const { id } = await parseParams(params, notificationIdSchema);
    return apiSuccess(await markNotificationRead(id));
  },
);
