import { describe, expect, it } from 'vitest';
import type { AuthUser } from '@/lib/auth';
import { sanitizeOrderTreeForUser, type OrderTree } from '@/lib/four-level-order-server';

const dealerUser: AuthUser = {
  id: 'user-1',
  name: 'Dealer',
  role: 'dealer_admin',
  tenant_id: 'dealer-1',
  tenant_type: 'dealer',
  permissions: [],
};

describe('order detail sanitization', () => {
  it('keeps dealer order content visible while hiding internal production fields', () => {
    const tree: OrderTree = {
      id: 'order-1',
      tenant_id: 'dealer-1',
      target_factory_id: 'factory-1',
      status: 'pending',
      total_amount: 12000,
      cost_amount: 7000,
      profit_amount: 5000,
      external_progress: '订单已发起',
      status_logs: [
        { id: 'log-1', target_type: 'order' },
        { id: 'log-2', target_type: 'production_task' },
      ],
      spaces: [
        {
          id: 'space-1',
          order_id: 'order-1',
          space_name: '主卧',
          products: [
            {
              id: 'product-1',
              order_id: 'order-1',
              space_id: 'space-1',
              product_name: '衣柜',
              cost_amount: 7000,
              production_tasks: [
                {
                  id: 'task-1',
                  task_name: '侧板 A',
                  assigned_worker_id: 'worker-1',
                  remark: '内部备注',
                  final_wage_amount: 100,
                },
              ],
            },
          ],
        },
      ],
    };

    const sanitized = sanitizeOrderTreeForUser(dealerUser, tree);

    expect(sanitized.spaces).toHaveLength(1);
    expect(sanitized.spaces[0].products).toHaveLength(1);
    expect(sanitized.spaces[0].products[0].production_tasks).toHaveLength(1);
    expect(sanitized.spaces[0].products[0].production_tasks[0].task_name).toBe('侧板 A');
    expect(sanitized.spaces[0].products[0].production_tasks[0]).not.toHaveProperty('assigned_worker_id');
    expect(sanitized.spaces[0].products[0].production_tasks[0]).not.toHaveProperty('final_wage_amount');
    expect(sanitized.spaces[0].products[0]).not.toHaveProperty('cost_amount');
    expect(sanitized).toHaveProperty('total_amount', 12000);
    expect(sanitized).not.toHaveProperty('cost_amount');
    expect(sanitized.status_logs).toEqual([{ id: 'log-1', target_type: 'order' }]);
  });
});
