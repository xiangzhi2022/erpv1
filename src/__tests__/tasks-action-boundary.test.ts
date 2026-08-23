import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import {
  notificationActionSchema,
  notificationCreateSchema,
  notificationQuerySchema,
  taskCreateSchema,
  taskMutationSchema,
  taskQuerySchema,
} from '@/lib/tasks/schemas';
import {
  createTaskNotificationWithAccess,
  createTaskWithNotificationWithAccess,
  markNotificationReadWithAccess,
  toggleTaskWithAccess,
  updateTaskWithNotificationWithAccess,
} from '@/lib/tasks/service';
import { createNotification, createTask } from '@/app/actions/tasks';
import { GET as getTasksRoute, POST as createTaskRoute } from '@/app/api/tasks/route';
import { POST as mutateNotificationsRoute } from '@/app/api/notifications/route';

vi.mock('@/lib/enterprise/context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/enterprise/context')>();
  return {
    ...actual,
    getEnterpriseContext: vi.fn().mockResolvedValue({
      userId: '11111111-1111-4111-8111-111111111111',
      enterpriseId: '22222222-2222-4222-8222-222222222222',
      membershipId: '11111111-1111-4111-8111-111111111111',
      displayName: '测试用户',
      enterpriseName: '测试企业',
      enterpriseType: 'manufacturer',
      grants: new Set(['tasks.read', 'tasks.manage', 'notifications.read', 'notifications.manage']),
      siteIds: new Set(),
      workshopIds: new Set(),
      permissionScopes: new Map(),
    }),
  };
});

const UUID = '11111111-1111-4111-8111-111111111111';
const ENTERPRISE_ID = '22222222-2222-4222-8222-222222222222';

describe('task and notification input boundaries', () => {
  it('rejects tenant and audit field injection on task creation', () => {
    expect(taskCreateSchema.safeParse({ title: '任务', enterprise_id: ENTERPRISE_ID }).success)
      .toBe(false);
    expect(taskCreateSchema.safeParse({ title: '任务', created_at: '2026-08-23' }).success)
      .toBe(false);
  });

  it('enforces the same strict schemas at the Server Action boundary', async () => {
    await expect(createTask({ title: '任务', enterprise_id: ENTERPRISE_ID }))
      .rejects.toMatchObject<ApiError>({ code: 'VALIDATION_FAILED', status: 422 });
    await expect(createNotification({
      task_id: UUID,
      type: 'assignment',
      title: '任务分配',
    })).rejects.toMatchObject<ApiError>({ code: 'VALIDATION_FAILED', status: 422 });
  });

  it('maps malformed route query and JSON inputs to validation responses', async () => {
    const invalidQuery = await getTasksRoute(new Request('http://localhost/api/tasks?pageSize=101'));
    expect(invalidQuery.status).toBe(422);
    const invalidQueryBody = await invalidQuery.json();
    expect(invalidQueryBody).toMatchObject({
      error: {
        code: 'VALIDATION_FAILED',
        message: '请求参数校验失败',
        requestId: expect.any(String),
      },
    });
    expect(invalidQuery.headers.get('x-request-id')).toBe(invalidQueryBody.error.requestId);

    const injectedBody = await createTaskRoute(new Request('http://localhost/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: '任务', enterprise_id: ENTERPRISE_ID }),
    }));
    expect(injectedBody.status).toBe(422);

    const invalidAction = await mutateNotificationsRoute(new Request('http://localhost/api/notifications', {
      method: 'POST',
      body: JSON.stringify({ action: 'deleteAll' }),
    }));
    expect(invalidAction.status).toBe(422);
  });

  it('validates task enums, references, dates, searches, and pagination limits', () => {
    expect(taskCreateSchema.safeParse({ title: '任务', status: 'unknown' }).success).toBe(false);
    expect(taskCreateSchema.safeParse({ title: '任务', category_id: 'foreign' }).success).toBe(false);
    expect(taskCreateSchema.safeParse({ title: '任务', assignee_id: 'worker-1' }).success).toBe(false);
    expect(taskCreateSchema.safeParse({ title: '任务', due_date: '2026-02-31' }).success).toBe(false);
    expect(taskCreateSchema.safeParse({ title: '任务', completed: true }).success).toBe(false);
    expect(taskCreateSchema.parse({ title: '任务', status: 'completed' })).toMatchObject({
      status: 'completed',
      completed: true,
    });
    expect(taskCreateSchema.safeParse({ title: '任务', status: 'completed', completed: true }).success)
      .toBe(true);
    expect(taskQuerySchema.safeParse({ search: 'x'.repeat(65) }).success).toBe(false);
    expect(taskQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false);
    expect(taskQuerySchema.safeParse({ pageSize: '', priority: '1e1' }).success).toBe(false);
    expect(taskQuerySchema.parse({ completed: 'false' }).completed).toBe(false);
    expect(taskQuerySchema.parse({ completed: false }).completed).toBe(false);
  });

  it('allows only a strict update or the explicit toggle action', () => {
    expect(taskMutationSchema.safeParse({}).success).toBe(false);
    expect(taskMutationSchema.safeParse({ action: 'toggle', completed: true }).success).toBe(false);
    expect(taskMutationSchema.safeParse({ title: '更新', enterprise_id: ENTERPRISE_ID }).success)
      .toBe(false);
    expect(taskMutationSchema.safeParse({ title: '更新' }).success).toBe(true);
    expect(taskMutationSchema.safeParse({ status: 'completed', completed: false }).success).toBe(false);
    expect(taskMutationSchema.parse({ status: 'completed' })).toMatchObject({
      status: 'completed',
      completed: true,
    });
  });

  it('validates notification filters, commands, references, and payload fields', () => {
    expect(notificationQuerySchema.safeParse({ type: 'arbitrary' }).success).toBe(false);
    expect(notificationQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(notificationActionSchema.safeParse({ action: 'deleteAll' }).success).toBe(false);
    expect(notificationCreateSchema.safeParse({
      task_id: UUID,
      recipient_id: UUID,
      type: 'assignment',
      title: '任务分配',
      enterprise_id: ENTERPRISE_ID,
    }).success).toBe(false);
    expect(notificationCreateSchema.safeParse({
      task_id: 'other-task',
      recipient_id: UUID,
      type: 'assignment',
      title: '任务分配',
    }).success).toBe(false);
  });
});

describe('task toggle concurrency', () => {
  it('returns a conflict when the completed value changes between read and update', async () => {
    let fromCalls = 0;
    const client = {
      from(table: string) {
        expect(table).toBe('tasks');
        fromCalls += 1;
        if (fromCalls === 1) {
          const readQuery = {
            select: () => readQuery,
            eq: () => readQuery,
            maybeSingle: async () => ({ data: { completed: false }, error: null }),
          };
          return readQuery;
        }

        throw new Error('toggle must not perform a direct update');
      },
      rpc: async (functionName: string, args: Record<string, unknown>) => {
        expect(functionName).toBe('toggle_task');
        expect(args).toEqual({
          target_enterprise_id: ENTERPRISE_ID,
          target_task_id: UUID,
          expected_completed: false,
        });
        return { data: null, error: { code: 'P0001', message: 'TASK_STATE_CONFLICT' } };
      },
    };

    await expect(toggleTaskWithAccess({
      client,
      enterpriseId: ENTERPRISE_ID,
    }, UUID)).rejects.toMatchObject<ApiError>({
      code: 'TASK_STATE_CONFLICT',
      status: 409,
    });
  });

  it('maps another recipient notification to a safe not-found result', async () => {
    const client = {
      rpc: async () => ({
        data: null,
        error: { code: 'P0002', message: 'NOTIFICATION_NOT_FOUND' },
      }),
    };
    await expect(markNotificationReadWithAccess({
      client,
      enterpriseId: ENTERPRISE_ID,
    }, UUID)).rejects.toMatchObject<ApiError>({
      code: 'NOTIFICATION_NOT_FOUND',
      status: 404,
    });
  });

  it('uses the task notification RPC parameter contract and reports deduplication', async () => {
    const notification = {
      id: UUID,
      enterprise_id: ENTERPRISE_ID,
      task_id: UUID,
      recipient_id: UUID,
      type: 'assignment',
      title: '任务分配',
      message: '请处理',
      read: false,
      created_at: '2026-08-23T00:00:00Z',
      updated_at: '2026-08-23T00:00:00Z',
    };
    const client = {
      rpc: async (functionName: string, args: Record<string, unknown>) => {
        if (functionName !== 'create_task_notification') {
          throw new Error('wrong RPC');
        }
        if (args.target_type !== 'assignment'
          || args.target_title !== '任务分配'
          || args.target_message !== '请处理') {
          throw new Error('wrong RPC argument names');
        }
        return { data: { notification, created: false }, error: null };
      },
    };
    await expect(createTaskNotificationWithAccess({
      client,
      enterpriseId: ENTERPRISE_ID,
    }, {
      task_id: UUID,
      recipient_id: UUID,
      type: 'assignment',
      title: '任务分配',
      message: '请处理',
    })).resolves.toMatchObject({
      notification: { id: UUID, recipient_id: UUID },
      created: false,
    });
  });

  it('creates and updates tasks only through atomic notification RPCs', async () => {
    const task = {
      id: UUID,
      enterprise_id: ENTERPRISE_ID,
      title: '原子任务',
      description: null,
      status: 'pending',
      priority: 0,
      category_id: null,
      assignee_id: null,
      assignee_name: '自由文本',
      assignee_avatar: null,
      due_date: null,
      completed: false,
      created_at: '2026-08-23T00:00:00Z',
      updated_at: '2026-08-23T00:00:00Z',
    };
    const calls: string[] = [];
    const client = {
      rpc: async (functionName: string, args: Record<string, unknown>) => {
        calls.push(functionName);
        const fields = args.task_fields as Record<string, unknown>;
        if ('completed' in fields || fields.assignee_name !== '自由文本') {
          throw new Error('unsafe task_fields shape');
        }
        return { data: { task, notification: null }, error: null };
      },
    };
    const access = { client, enterpriseId: ENTERPRISE_ID };
    await expect(createTaskWithNotificationWithAccess(access, {
      title: '原子任务',
      status: 'pending',
      priority: 0,
      completed: false,
      assignee_name: '自由文本',
    })).resolves.toMatchObject({ task: { id: UUID }, notification: null });
    await expect(updateTaskWithNotificationWithAccess(access, UUID, {
      status: 'pending',
      completed: false,
      assignee_name: '自由文本',
    })).resolves.toMatchObject({ task: { id: UUID }, notification: null });
    expect(calls).toEqual(['create_task_with_notification', 'update_task_with_notification']);
  });
});
