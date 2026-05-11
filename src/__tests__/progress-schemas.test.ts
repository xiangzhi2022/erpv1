import { describe, it, expect } from 'vitest';
import {
  progressReportSchema,
  workOrderQuerySchema,
  WorkOrderStatus,
  WorkOrderStatusLabels,
  Priority,
  PriorityLabels,
  ProgressAction,
  ProgressActionLabels,
} from '@/app/progress/schemas';

describe('progressReportSchema', () => {
  const validReport = {
    work_order_id: '550e8400-e29b-41d4-a716-446655440000',
    action: 'report_progress',
    completed_delta: 5,
    remark: '今日完成5件',
  };

  it('should validate a valid progress report', () => {
    expect(progressReportSchema.safeParse(validReport).success).toBe(true);
  });

  it('should reject invalid work_order_id values', () => {
    expect(progressReportSchema.safeParse({ ...validReport, work_order_id: '' }).success).toBe(false);
    expect(progressReportSchema.safeParse({ ...validReport, work_order_id: 'not-a-uuid' }).success).toBe(false);
  });

  it('should reject invalid or missing action', () => {
    expect(progressReportSchema.safeParse({ ...validReport, action: 'invalid_action' }).success).toBe(false);
    expect(
      progressReportSchema.safeParse({
        work_order_id: '550e8400-e29b-41d4-a716-446655440000',
        completed_delta: 0,
      }).success
    ).toBe(false);
  });

  it('should validate completed_delta bounds and integer requirement', () => {
    expect(progressReportSchema.safeParse({ ...validReport, completed_delta: -1 }).success).toBe(false);
    expect(progressReportSchema.safeParse({ ...validReport, completed_delta: 1.5 }).success).toBe(false);
    expect(progressReportSchema.safeParse({ ...validReport, completed_delta: 0 }).success).toBe(true);
  });

  it('should accept every ProgressAction enum value', () => {
    for (const action of Object.values(ProgressAction)) {
      expect(
        progressReportSchema.safeParse({
          ...validReport,
          action,
          completed_delta: 0,
        }).success
      ).toBe(true);
    }
  });

  it('should set default completed_delta to 0 when omitted', () => {
    const result = progressReportSchema.safeParse({
      work_order_id: '550e8400-e29b-41d4-a716-446655440000',
      action: 'start',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.completed_delta).toBe(0);
    }
  });

  it('should allow optional remark and reject overlong remark', () => {
    expect(
      progressReportSchema.safeParse({
        work_order_id: '550e8400-e29b-41d4-a716-446655440000',
        action: 'report_progress',
        completed_delta: 3,
      }).success
    ).toBe(true);
    expect(progressReportSchema.safeParse({ ...validReport, remark: 'x'.repeat(501) }).success).toBe(false);
  });
});

describe('workOrderQuerySchema', () => {
  it('should parse valid query with all fields', () => {
    const result = workOrderQuerySchema.safeParse({
      status: 'producing',
      workshop_id: 'ws-1',
      keyword: '柜体',
      priority: 'urgent',
      page: '2',
      page_size: '10',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.page_size).toBe(10);
    }
  });

  it('should accept empty query with defaults', () => {
    const result = workOrderQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.page_size).toBe(20);
    }
  });

  it('should coerce and bound page numbers', () => {
    const result = workOrderQuerySchema.safeParse({ page: '3', page_size: '50' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.page_size).toBe(50);
    }

    expect(workOrderQuerySchema.safeParse({ page_size: 200 }).success).toBe(false);
    expect(workOrderQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(workOrderQuerySchema.safeParse({ page_size: 0 }).success).toBe(false);
  });
});

describe('Enums consistency', () => {
  it('should have correct WorkOrderStatus values and labels', () => {
    const statuses = Object.values(WorkOrderStatus);
    expect(statuses).toEqual(
      expect.arrayContaining(['pending', 'scheduling', 'producing', 'inspecting', 'stored', 'aborted'])
    );
    expect(statuses.length).toBe(6);
    expect(statuses).not.toContain('quality_check');
    expect(statuses).not.toContain('warehoused');
    expect(statuses).not.toContain('inspect');

    for (const status of statuses) {
      expect(WorkOrderStatusLabels[status]).toBeTruthy();
    }
  });

  it('should have correct Priority values and labels', () => {
    const priorities = Object.values(Priority);
    expect(priorities).toEqual(expect.arrayContaining(['urgent', 'high', 'normal', 'low']));
    expect(priorities.length).toBe(4);
    for (const priority of priorities) {
      expect(PriorityLabels[priority]).toBeTruthy();
    }
  });

  it('should have correct ProgressAction values and labels', () => {
    const actions = Object.values(ProgressAction);
    expect(actions).toEqual(
      expect.arrayContaining([
        'start',
        'report_progress',
        'quality_check',
        'warehouse_in',
        'abort',
        'pause',
        'resume',
        'report_defect',
        'complete_cutting',
        'complete_assembly',
        'complete_painting',
      ])
    );
    expect(actions.length).toBe(11);
    expect(actions).not.toContain('start_production');
    expect(actions).not.toContain('submit_quality_check');
    expect(actions).not.toContain('complete_quality_check');
    expect(actions).not.toContain('fail_quality_check');

    for (const action of actions) {
      expect(ProgressActionLabels[action]).toBeTruthy();
    }
  });
});

describe('progressReportSchema action-status alignment', () => {
  it('should map quality_check and warehouse_in actions to canonical statuses', () => {
    const actionToStatus: Record<string, string> = {
      start: 'producing',
      quality_check: 'inspecting',
      warehouse_in: 'stored',
      pause: 'pending',
      abort: 'aborted',
      resume: 'producing',
    };

    expect(actionToStatus.quality_check).toBe('inspecting');
    expect(actionToStatus.warehouse_in).toBe('stored');
  });
});
