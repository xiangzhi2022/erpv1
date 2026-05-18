import { describe, expect, it } from 'vitest';
import { calculateTaskWage } from '@/lib/four-level-order';
import {
  canAccessRoute,
  canViewField,
  filterOrderForRole,
  filterSensitiveFields,
  filterTaskForRole,
  filterWageForRole,
  mapInternalStatusToDealerStatus,
} from '@/lib/permission-utils';
import type { AccessUser } from '@/lib/role-access';

describe('permission and field filtering', () => {
  const worker: AccessUser = { role: 'employee', permissions: ['factory_worker'] };
  const dealer: AccessUser = { role: 'employee', tenant_type: 'dealer', permissions: ['dealer_order_tracker'] };
  const dataEntry: AccessUser = { role: 'employee', permissions: ['factory_data_entry'] };
  const finance: AccessUser = { role: 'employee', permissions: ['factory_finance', 'factory_profit_view'] };
  const manager: AccessUser = { role: 'employee', permissions: ['factory_production_manager'] };
  const boss: AccessUser = { role: 'employee', permissions: ['factory_boss'] };

  it('filters worker task fields and keeps own wage amount shape', () => {
    const task = filterTaskForRole({
      id: 'task-1',
      status: 'submitted',
      total_amount: 1000,
      cost_amount: 400,
      profit_amount: 600,
      wage_rule_id: 'rule-1',
      unit_price: 8,
      final_wage_amount: 20,
      wage_record: { wage_amount: 20, status: 'pending', unit_price: 8 },
    }, worker);

    expect(task.total_amount).toBeUndefined();
    expect(task.cost_amount).toBeUndefined();
    expect(task.profit_amount).toBeUndefined();
    expect(task.wage_rule_id).toBeUndefined();
    expect(task.unit_price).toBeUndefined();
    expect(task.wage_record).toEqual({ wage_amount: 20, status: 'pending' });
  });

  it('filters dealer order fields and maps external status', () => {
    const order = filterOrderForRole({
      id: 'order-1',
      status: 'ready_to_ship',
      expected_ship_date: '2026-06-01',
      total_amount: 1000,
      cost_amount: 400,
      profit_amount: 600,
      production_tasks: [{ worker: { name: 'Worker' }, final_wage_amount: 20 }],
      spaces: [{ id: 'space-1' }],
      internal_remark: 'internal',
    }, dealer);

    expect(order.expected_ship_date).toBe('2026-06-01');
    expect(order.external_status).toBe('待发货');
    expect(order.production_tasks).toBeUndefined();
    expect(order.spaces).toBeUndefined();
    expect(order.cost_amount).toBeUndefined();
    expect(order.profit_amount).toBeUndefined();
    expect(mapInternalStatusToDealerStatus('pending_quality_check')).toBe('质检中');
  });

  it('keeps data entry away from price, cost and wage fields', () => {
    const filtered = filterSensitiveFields({
      customer_name: 'Customer',
      total_amount: 1000,
      cost_amount: 500,
      profit_amount: 500,
      worker_wage_records: [{ wage_amount: 20 }],
      spaces: [{ space_name: 'Kitchen' }],
    }, dataEntry);

    expect(filtered.customer_name).toBe('Customer');
    expect(filtered.spaces).toEqual([{ space_name: 'Kitchen' }]);
    expect(filtered.total_amount).toBeUndefined();
    expect(filtered.cost_amount).toBeUndefined();
    expect(filtered.profit_amount).toBeUndefined();
    expect(filtered.worker_wage_records).toBeUndefined();
  });

  it('distinguishes finance, production manager and boss permissions', () => {
    expect(canViewField(finance, 'profit_amount')).toBe(true);
    expect(canViewField(manager, 'profit_amount')).toBe(false);
    expect(canAccessRoute(manager, '/production/tasks')).toBe(true);
    expect(canAccessRoute(manager, '/settings/departments')).toBe(false);
    expect(canAccessRoute(boss, '/settings/departments')).toBe(true);
    expect(canAccessRoute(worker, '/finance/orders')).toBe(false);
    expect(canAccessRoute(dealer, '/production/tasks')).toBe(false);
  });

  it('filters wage records for non-finance roles', () => {
    const filtered = filterWageForRole({ id: 'wage-1', wage_rule_id: 'rule', unit_price: 10, wage_amount: 50 }, worker);
    expect(filtered.wage_rule_id).toBeUndefined();
    expect(filtered.unit_price).toBeUndefined();
    expect(filtered.wage_amount).toBe(50);
  });
});

describe('wage calculation coverage', () => {
  it('supports all configured calculation methods', () => {
    expect(calculateTaskWage({ quantity: 3 }, { unit_price: 2, calculation_method: 'by_piece' })).toBe(6);
    expect(calculateTaskWage({ area: 4 }, { unit_price: 8, calculation_method: 'by_area' })).toBe(32);
    expect(calculateTaskWage({ meter_count: 5, length: 1000 }, { unit_price: 3, calculation_method: 'by_meter' })).toBe(15);
    expect(calculateTaskWage({ quantity: 2 }, { unit_price: 30, calculation_method: 'by_set' })).toBe(60);
    expect(calculateTaskWage({ quantity: 99 }, { unit_price: 12, calculation_method: 'fixed' })).toBe(12);
  });
});
