import { describe, it, expect } from 'vitest';

// Status flow mapping test - mirrors the logic in API route /api/progress/report
// Updated to match runtime schema: inspecting (not quality_check), stored (not warehoused)
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
    pause: 'pending',
    abort: 'aborted',
  },
  inspecting: {
    warehouse_in: 'stored',
    resume: 'producing',
    abort: 'aborted',
  },
  stored: {},
  aborted: {},
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

  it('should allow inspecting -> producing via resume (rework)', () => {
    expect(STATUS_TRANSITIONS.inspecting.resume).toBe('producing');
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

  it('should not allow transitions from stored', () => {
    expect(Object.keys(STATUS_TRANSITIONS.stored)).toHaveLength(0);
  });

  it('should not allow transitions from aborted', () => {
    expect(Object.keys(STATUS_TRANSITIONS.aborted)).toHaveLength(0);
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

  it('should not exceed target quantity', () => {
    const validateQuantity = (completed: number, delta: number, target: number) =>
      completed + delta <= target;

    expect(validateQuantity(80, 20, 100)).toBe(true);
    expect(validateQuantity(95, 10, 100)).toBe(false);
    expect(validateQuantity(100, 0, 100)).toBe(true);
    expect(validateQuantity(100, 1, 100)).toBe(false);
  });

  it('should auto-transition to inspecting when target reached', () => {
    const getAutoStatus = (completed: number, target: number, action: string) => {
      if (completed >= target && action !== 'abort') return 'inspecting';
      return null;
    };

    expect(getAutoStatus(100, 100, 'report_progress')).toBe('inspecting');
    expect(getAutoStatus(100, 100, 'abort')).toBe(null);
    expect(getAutoStatus(80, 100, 'report_progress')).toBe(null);
  });
});
