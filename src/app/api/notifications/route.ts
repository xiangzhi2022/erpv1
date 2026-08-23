import { withApiHandler } from '@/lib/api/handler';
import { parseJson, parseQuery } from '@/lib/api/request';
import { apiSuccess } from '@/lib/api/response';
import { notificationActionSchema, notificationQuerySchema } from '@/lib/tasks/schemas';
import {
  checkOverdueTasks,
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
} from '@/app/actions/tasks';

export const GET = withApiHandler(
  { policy: 'enterprise' },
  async ({ request }) => {
    const filters = parseQuery(request, notificationQuerySchema);
    const [notifications, unreadCount] = await Promise.all([
      getNotifications(filters),
      getUnreadNotificationCount(),
    ]);
    return apiSuccess(notifications, { meta: { unreadCount } });
  },
);

export const POST = withApiHandler<{ markedCount: number } | { newNotifications: number }>(
  { policy: 'enterprise' },
  async ({ request }) => {
    const { action } = await parseJson(request, notificationActionSchema);
    return action === 'markAllRead'
      ? apiSuccess({ markedCount: await markAllNotificationsRead() })
      : apiSuccess({ newNotifications: await checkOverdueTasks() });
  },
);
