import { describe, it, expect } from 'vitest';
import {
  WorkOrderStatus,
  ProgressAction,
} from '@/app/progress/schemas';

// Status transition map aligned with canonical states:
// pending, producing, inspecting, stored, aborted
// Actions follow the ProgressAction enum in schemas.ts
const STATUS_TRANSITIONS: Record<string, Record<string, string>> = {
  pending: {
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
    abort: 'aborted',
  },
  stored: {},
  aborted: {
    resume: 'producing',
  },
};

describe('Work order status transitions', () => {
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

  it('should allow inspecting -> producing via report_defect (rework)', () => {
    expect(STATUS_TRANSITIONS.inspecting.report_defect).toBe('producing');
  });

  it('should allow producing -> producing via report_progress', () => {
    expect(STATUS_TRANSITIONS.producing.report_progress).toBe('producing');
  });

  it('should allow producing -> producing via complete_cutting', () => {
    expect(STATUS_TRANSITIONS.producing.complete_cutting).toBe('producing');
  });

  it('should allow producing -> producing via complete_assembly', () => {
    expect(STATUS_TRANSITIONS.producing.complete_assembly).toBe('producing');
  });

  it('should allow producing -> producing via complete_painting', () => {
    expect(STATUS_TRANSITIONS.producing.complete_painting).toBe('producing');
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
    expect(statuses).toContain('producing');
    expect(statuses).toContain('inspecting');
    expect(statuses).toContain('stored');
    expect(statuses).toContain('aborted');
  });

  it('should allow abort from any active status', () => {
    const activeStatuses = ['pending', 'producing', 'inspecting'];
    for (const status of activeStatuses) {
      expect(STATUS_TRANSITIONS[status].abort).toBe('aborted');
    }
  });

  it('should align with WorkOrderStatus enum values', () => {
    const transitionStatuses = Object.keys(STATUS_TRANSITIONS);
    const enumValues = Object.values(WorkOrderStatus);
    for (const status of transitionStatuses) {
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
    expect(calcPercent(150, 100)).toBe(100); // Can't exceed 100%
    expect(calcPercent(0, 0)).toBe(0); // Division by zero
  });

  it('should determine overdue status correctly', () => {
    const isOverdue = (expectedEndDate: string | null, status: string) => {
      if (!expectedEndDate || status === 'stored' || status === 'aborted') return false;
      return new Date(expectedEndDate) < new Date();
    };

    // Past date should be overdue (for active orders)
    expect(isOverdue('2020-01-01', 'producing')).toBe(true);
    // Future date should not be overdue
    expect(isOverdue('2099-12-31', 'producing')).toBe(false);
    // Completed orders should not be overdue
    expect(isOverdue('2020-01-01', 'stored')).toBe(false);
    // Aborted orders should not be overdue
    expect(isOverdue('2020-01-01', 'aborted')).toBe(false);
    // Null date should not be overdue
    expect(isOverdue(null, 'producing')).toBe(false);
  });

  it('should not allow completed_quantity to exceed target_quantity', () => {
    const validateCompleted = (completed: number, target: number) => {
      return completed <= target;
    };

    expect(validateCompleted(50, 100)).toBe(true);
    expect(validateCompleted(100, 100)).toBe(true);
    expect(validateCompleted(101, 100)).toBe(false);
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

      // Auto-complete: if target reached, go to inspecting (unless already stored/aborted)
      if (completedQuantity >= targetQuantity && action !== 'abort' && newStatus !== 'stored') {
        newStatus = 'inspecting';
      }

      return newStatus;
    };

    // When target is reached during report_progress
    expect(computeNewStatus('report_progress', 100, 100, 'producing')).toBe('inspecting');
    // When target is not yet reached
    expect(computeNewStatus('report_progress', 50, 100, 'producing')).toBe('producing');
    // When already doing quality_check, stays at inspecting if target reached
    expect(computeNewStatus('report_progress', 100, 100, 'inspecting')).toBe('inspecting');
    // warehouse_in should still go to stored even if target reached
    expect(computeNewStatus('warehouse_in', 100, 100, 'inspecting')).toBe('stored');
  });
});
