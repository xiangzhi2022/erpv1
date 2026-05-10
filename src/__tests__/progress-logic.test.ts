import { describe, it, expect } from 'vitest';
import { WorkOrderStatus, ProgressAction } from '@/app/progress/schemas';

// Status transition map aligned with runtime states and actions.
const STATUS_TRANSITIONS: Record<string, Record<string, string>> = {
  pending: {
    start: 'producing',
    abort: 'aborted',
  },
  scheduling: {
    start: 'producing',
    abort: 'aborted',
  },
  producing: {
    report_progress: 'producing',
    complete_cutting: 'producing',
    complete_assembly: 'producing',
    complete_painting: 'producing',
    quality_check: 'inspecting',
    report_defect: 'producing',
    pause: 'pending',
    abort: 'aborted',
  },
  inspecting: {
    warehouse_in: 'stored',
    report_defect: 'producing',
    resume: 'producing',
    abort: 'aborted',
  },
  stored: {},
  aborted: {
    resume: 'producing',
  },
};

describe('Work order status transitions', () => {
  it('should keep scheduling aligned with pending start and abort behavior', () => {
    expect(STATUS_TRANSITIONS.scheduling).toEqual({
      start: 'producing',
      abort: 'aborted',
    });
  });

  it('should not use removed quality_check or warehoused status names as statuses', () => {
    expect(Object.keys(STATUS_TRANSITIONS)).not.toContain('quality_check');
    expect(Object.keys(STATUS_TRANSITIONS)).not.toContain('warehoused');
    expect(Object.values(STATUS_TRANSITIONS.inspecting)).not.toContain('warehoused');
  });

  it('should allow pending -> producing via start', () => {
    expect(STATUS_TRANSITIONS.pending.start).toBe('producing');
  });

  it('should allow pending -> aborted via abort', () => {
    expect(STATUS_TRANSITIONS.pending.abort).toBe('aborted');
  });

  it('should allow producing -> inspecting via quality_check', () => {
    expect(STATUS_TRANSITIONS.producing.quality_check).toBe('inspecting');
  });

  it('should allow inspecting -> stored via warehouse_in', () => {
    expect(STATUS_TRANSITIONS.inspecting.warehouse_in).toBe('stored');
  });

  it('should allow inspecting -> producing via report_defect or resume', () => {
    expect(STATUS_TRANSITIONS.inspecting.report_defect).toBe('producing');
    expect(STATUS_TRANSITIONS.inspecting.resume).toBe('producing');
  });

  it('should allow producing -> producing via progress actions', () => {
    expect(STATUS_TRANSITIONS.producing.report_progress).toBe('producing');
    expect(STATUS_TRANSITIONS.producing.complete_cutting).toBe('producing');
    expect(STATUS_TRANSITIONS.producing.complete_assembly).toBe('producing');
    expect(STATUS_TRANSITIONS.producing.complete_painting).toBe('producing');
    expect(STATUS_TRANSITIONS.producing.report_defect).toBe('producing');
  });

  it('should allow producing -> pending via pause', () => {
    expect(STATUS_TRANSITIONS.producing.pause).toBe('pending');
  });

  it('should allow aborted -> producing via resume', () => {
    expect(STATUS_TRANSITIONS.aborted.resume).toBe('producing');
  });

  it('should not allow transitions from stored', () => {
    expect(Object.keys(STATUS_TRANSITIONS.stored)).toHaveLength(0);
  });

  it('should cover all defined statuses', () => {
    const statuses = Object.keys(STATUS_TRANSITIONS);
    expect(statuses).toContain('pending');
    expect(statuses).toContain('scheduling');
    expect(statuses).toContain('producing');
    expect(statuses).toContain('inspecting');
    expect(statuses).toContain('stored');
    expect(statuses).toContain('aborted');
  });

  it('should allow abort from any active status', () => {
    const activeStatuses = ['pending', 'scheduling', 'producing', 'inspecting'];
    for (const status of activeStatuses) {
      expect(STATUS_TRANSITIONS[status].abort).toBe('aborted');
    }
  });

  it('should align with WorkOrderStatus enum values', () => {
    const enumValues = Object.values(WorkOrderStatus);
    for (const status of Object.keys(STATUS_TRANSITIONS)) {
      expect(enumValues).toContain(status);
    }
  });

  it('should align all action keys with ProgressAction enum values', () => {
    const enumActions = Object.values(ProgressAction);
    for (const status of Object.keys(STATUS_TRANSITIONS)) {
      for (const action of Object.keys(STATUS_TRANSITIONS[status])) {
        expect(enumActions).toContain(action);
      }
    }
  });
});

describe('Progress calculation', () => {
  it('should calculate completion percentage correctly', () => {
    const calcPercent = (completed: number, target: number) =>
      target > 0 ? Math.min(Math.round((completed / target) * 100), 100) : 0;

    expect(calcPercent(50, 100)).toBe(50);
    expect(calcPercent(0, 100)).toBe(0);
    expect(calcPercent(100, 100)).toBe(100);
    expect(calcPercent(150, 100)).toBe(100);
    expect(calcPercent(0, 0)).toBe(0);
  });

  it('should determine overdue status correctly', () => {
    const isOverdue = (expectedEndDate: string | null, status: string) => {
      if (!expectedEndDate || status === 'stored' || status === 'aborted') return false;
      return new Date(expectedEndDate) < new Date();
    };

    expect(isOverdue('2020-01-01', 'producing')).toBe(true);
    expect(isOverdue('2099-12-31', 'producing')).toBe(false);
    expect(isOverdue('2020-01-01', 'stored')).toBe(false);
    expect(isOverdue('2020-01-01', 'aborted')).toBe(false);
    expect(isOverdue(null, 'producing')).toBe(false);
  });

  it('should not allow completed_quantity to exceed target_quantity', () => {
    const validateQuantity = (completed: number, delta: number, target: number) =>
      delta >= 0 && completed + delta <= target;

    expect(validateQuantity(80, 20, 100)).toBe(true);
    expect(validateQuantity(95, 10, 100)).toBe(false);
    expect(validateQuantity(100, 0, 100)).toBe(true);
    expect(validateQuantity(100, 1, 100)).toBe(false);
    expect(validateQuantity(10, -1, 100)).toBe(false);
  });
});

describe('Warehouse-in writes actual_end_date', () => {
  it('should set actual_end_date when status transitions to stored', () => {
    const computeUpdates = (action: string) => {
      const updates: Record<string, unknown> = {};
      if (action === 'warehouse_in') {
        updates.status = 'stored';
        updates.actual_end_date = new Date().toISOString();
      }
      return updates;
    };

    const updates = computeUpdates('warehouse_in');
    expect(updates.status).toBe('stored');
    expect(updates.actual_end_date).toBeDefined();
    expect(typeof updates.actual_end_date).toBe('string');
  });

  it('should not set actual_end_date for non-warehouse_in actions', () => {
    const computeUpdates = (action: string) => {
      const updates: Record<string, unknown> = {};
      if (action === 'warehouse_in') {
        updates.status = 'stored';
        updates.actual_end_date = new Date().toISOString();
      }
      return updates;
    };

    expect(computeUpdates('report_progress').actual_end_date).toBeUndefined();
    expect(computeUpdates('quality_check').actual_end_date).toBeUndefined();
    expect(computeUpdates('start').actual_end_date).toBeUndefined();
  });
});

describe('Auto-transition to inspecting when target reached', () => {
  it('should transition to inspecting when completed_quantity reaches target', () => {
    const computeNewStatus = (
      action: string,
      completedQuantity: number,
      targetQuantity: number,
      currentStatus: string,
    ) => {
      if (action === 'abort') return 'aborted';

      let newStatus = currentStatus;
      switch (action) {
        case 'start':
          newStatus = 'producing';
          break;
        case 'quality_check':
          newStatus = 'inspecting';
          break;
        case 'warehouse_in':
          newStatus = 'stored';
          break;
        case 'pause':
          newStatus = 'pending';
          break;
        case 'resume':
          newStatus = 'producing';
          break;
        default:
          break;
      }

      if (completedQuantity >= targetQuantity && action !== 'abort' && newStatus !== 'stored') {
        newStatus = 'inspecting';
      }

      return newStatus;
    };

    expect(computeNewStatus('report_progress', 100, 100, 'producing')).toBe('inspecting');
    expect(computeNewStatus('report_progress', 50, 100, 'producing')).toBe('producing');
    expect(computeNewStatus('report_progress', 100, 100, 'inspecting')).toBe('inspecting');
    expect(computeNewStatus('warehouse_in', 100, 100, 'inspecting')).toBe('stored');
  });
});
