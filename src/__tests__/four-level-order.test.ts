import { describe, expect, it } from 'vitest';
import {
  calculateTaskWage,
  canEditFinancialFields,
  canManageProduction,
  canManageWageRules,
  canManageWages,
  canOperateWorkerTask,
  canViewFinancialFields,
  canViewWageSummary,
  externalDealerStatus,
  ORDER_STATUS_LOG_TARGETS,
  selectBestWageRuleForTask,
} from '@/lib/four-level-order';
import { scoreProductionWorkerForTask } from '@/lib/four-level-order-server';
import type { AccessUser } from '@/lib/role-access';

describe('four-level order wage calculation', () => {
  it('calculates piece, area, meter, set and fixed wages', () => {
    expect(calculateTaskWage({ quantity: 3 }, { unit_price: 2, calculation_method: 'by_piece' })).toBe(6);
    expect(calculateTaskWage({ area: 4.5 }, { unit_price: 10, calculation_method: 'by_area' })).toBe(45);
    expect(calculateTaskWage({ length: 2500, quantity: 2 }, { unit_price: 1.5, calculation_method: 'by_meter' })).toBe(3.75);
    expect(calculateTaskWage({ meter_count: 12, length: 2500 }, { unit_price: 1.5, calculation_method: 'by_meter' })).toBe(18);
    expect(calculateTaskWage({ quantity: 2 }, { unit_price: 80, calculation_method: 'by_set' })).toBe(160);
    expect(calculateTaskWage({ quantity: 99 }, { unit_price: 10, calculation_method: 'fixed' })).toBe(10);
  });

  it('uses factory wage defaults and structured extra amounts', () => {
    expect(calculateTaskWage({ task_type: 'board', length: 2000, width: 600 }, { unit_price: 30, calculation_method: 'by_area' })).toBe(36);
    expect(calculateTaskWage({ task_type: 'door', quantity: 2 }, { unit_price: 45, calculation_method: 'by_set' })).toBe(90);
    expect(calculateTaskWage({ task_type: 'special', quantity: 9 }, { unit_price: 100, calculation_method: 'fixed', extra_amount: 20 })).toBe(120);
  });

  it('prefers personal wage rules before position and company rules', () => {
    const best = selectBestWageRuleForTask([
      { id: 'company', task_type: 'board', scope_type: 'company', unit_price: 10, calculation_method: 'by_area', enabled: true },
      { id: 'position', task_type: 'board', scope_type: 'position', position_id: 'pos-1', unit_price: 20, calculation_method: 'by_area', enabled: true },
      { id: 'worker', task_type: 'board', scope_type: 'worker', worker_id: 'worker-1', unit_price: 30, calculation_method: 'by_area', enabled: true },
    ], { task_type: 'board', assigned_worker_id: 'worker-1' }, { id: 'worker-1', position_ids: ['pos-1'] });

    expect(best?.id).toBe('worker');
  });

  it('maps internal production states to dealer-safe status labels', () => {
    expect(externalDealerStatus('accepted')).toBe('订单已接收');
    expect(externalDealerStatus('pending_assign')).toBe('已排产');
    expect(externalDealerStatus('pending_quality_check')).toBe('质检中');
    expect(externalDealerStatus('ready_to_ship')).toBe('待发货');
    expect(externalDealerStatus('abnormal')).toBe('订单异常');
  });

  it('allows wage records in status logs', () => {
    expect(ORDER_STATUS_LOG_TARGETS).toContain('wage_record');
  });
});

describe('four-level order role capabilities', () => {
  const boss: AccessUser = { role: 'employee', permissions: ['factory_boss'] };
  const manager: AccessUser = { role: 'employee', permissions: ['factory_production_manager'] };
  const worker: AccessUser = { role: 'employee', permissions: ['factory_worker'] };
  const dataEntry: AccessUser = { role: 'employee', permissions: ['factory_data_entry'] };
  const finance: AccessUser = { role: 'employee', permissions: ['factory_finance'] };

  it('allows production managers to manage tasks and wages without financial profit access', () => {
    expect(canManageProduction(manager)).toBe(true);
    expect(canManageWages(manager)).toBe(true);
    expect(canManageWageRules(manager)).toBe(false);
    expect(canViewWageSummary(manager)).toBe(true);
    expect(canViewFinancialFields(manager)).toBe(false);
  });

  it('keeps worker and data-entry permissions narrow', () => {
    expect(canOperateWorkerTask(worker)).toBe(true);
    expect(canManageProduction(worker)).toBe(false);
    expect(canViewWageSummary(worker)).toBe(false);
    expect(canViewFinancialFields(dataEntry)).toBe(false);
    expect(canEditFinancialFields(dataEntry)).toBe(false);
  });

  it('allows boss and finance to see financial fields with different production powers', () => {
    expect(canViewFinancialFields(boss)).toBe(true);
    expect(canEditFinancialFields(boss)).toBe(true);
    expect(canManageWageRules(boss)).toBe(true);
    expect(canViewFinancialFields(finance)).toBe(true);
    expect(canEditFinancialFields(finance)).toBe(true);
    expect(canManageProduction(finance)).toBe(false);
  });
});

describe('production worker recommendation', () => {
  it('prioritizes workers whose craft matches the task process', () => {
    const cutting = scoreProductionWorkerForTask(
      { craft_type: 'cutting', skill_tags: ['开料'] },
      { task_type: 'board', process_name: '开料' },
      ['factory_carpenter']
    );
    const packing = scoreProductionWorkerForTask(
      { craft_type: 'packaging', skill_tags: ['包装'] },
      { task_type: 'board', process_name: '开料' },
      ['factory_packer']
    );

    expect(cutting.score).toBeGreaterThan(packing.score);
    expect(cutting.reasons).toContain('开料');
  });
});
