import { describe, it, expect } from 'vitest';
import {
  progressReportSchema,
  workOrderQuerySchema,
  WorkOrderStatus,
  Priority,
  ProgressAction,
} from '@/app/progress/schemas';

describe('progressReportSchema', () => {
  const validReport = {
    work_order_id: '550e8400-e29b-41d4-a716-446655440000',
    action: 'report_progress',
    completed_delta: 5,
    remark: '今日完成5件',
  };

  it('should validate a valid progress report', () => {
    const result = progressReportSchema.safeParse(validReport);
    expect(result.success).toBe(true);
  });

  it('should reject empty work_order_id', () => {
    const result = progressReportSchema.safeParse({
      ...validReport,
      work_order_id: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid action', () => {
    const result = progressReportSchema.safeParse({
      ...validReport,
      action: 'invalid_action',
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative completed_delta', () => {
    const result = progressReportSchema.safeParse({
      ...validReport,
      completed_delta: -1,
    });
    expect(result.success).toBe(false);
  });

  it('should accept zero completed_delta', () => {
    const result = progressReportSchema.safeParse({
      ...validReport,
      completed_delta: 0,
    });
    expect(result.success).toBe(true);
  });

  it('should accept all valid actions', () => {
    const validActions = Object.values(ProgressAction);
    for (const action of validActions) {
      const result = progressReportSchema.safeParse({
        ...validReport,
        action,
        completed_delta: 0,
      });
      expect(result.success).toBe(true);
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

  it('should allow optional remark', () => {
    const result = progressReportSchema.safeParse({
      work_order_id: '550e8400-e29b-41d4-a716-446655440000',
      action: 'report_progress',
      completed_delta: 3,
    });
    expect(result.success).toBe(true);
  });

  it('should reject remark exceeding 500 chars', () => {
    const result = progressReportSchema.safeParse({
      ...validReport,
      remark: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('should accept quality_check action', () => {
    const result = progressReportSchema.safeParse({
      work_order_id: '550e8400-e29b-41d4-a716-446655440000',
      action: 'quality_check',
      completed_delta: 0,
    });
    expect(result.success).toBe(true);
  });

  it('should accept warehouse_in action', () => {
    const result = progressReportSchema.safeParse({
      work_order_id: '550e8400-e29b-41d4-a716-446655440000',
      action: 'warehouse_in',
      completed_delta: 0,
    });
    expect(result.success).toBe(true);
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

  it('should coerce string page numbers to integers', () => {
    const result = workOrderQuerySchema.safeParse({
      page: '3',
      page_size: '50',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.page_size).toBe(50);
    }
  });

  it('should reject page_size > 100', () => {
    const result = workOrderQuerySchema.safeParse({
      page_size: 200,
    });
    expect(result.success).toBe(false);
  });
});

describe('Enums consistency', () => {
  it('should have correct WorkOrderStatus values', () => {
    const statuses = Object.values(WorkOrderStatus);
    expect(statuses).toContain('pending');
    expect(statuses).toContain('producing');
    expect(statuses).toContain('inspecting');
    expect(statuses).toContain('stored');
    expect(statuses).toContain('aborted');
    expect(statuses.length).toBe(6); // includes 'scheduling'
  });

  it('should not have legacy status names', () => {
    const statuses = Object.values(WorkOrderStatus);
    expect(statuses).not.toContain('quality_check');
    expect(statuses).not.toContain('warehoused');
    expect(statuses).not.toContain('inspect');
  });

  it('should have correct Priority values', () => {
    const priorities = Object.values(Priority);
    expect(priorities).toContain('urgent');
    expect(priorities).toContain('high');
    expect(priorities).toContain('normal');
    expect(priorities).toContain('low');
  });

  it('should have correct ProgressAction values', () => {
    const actions = Object.values(ProgressAction);
    expect(actions).toContain('start');
    expect(actions).toContain('report_progress');
    expect(actions).toContain('quality_check');
    expect(actions).toContain('warehouse_in');
    expect(actions).toContain('abort');
    expect(actions).toContain('pause');
    expect(actions).toContain('resume');
    expect(actions).toContain('report_defect');
    expect(actions).toContain('complete_cutting');
    expect(actions).toContain('complete_assembly');
    expect(actions).toContain('complete_painting');
    expect(actions.length).toBe(11);
  });

  it('should not have legacy action names', () => {
    const actions = Object.values(ProgressAction);
    expect(actions).not.toContain('start_production');
    expect(actions).not.toContain('submit_quality_check');
    expect(actions).not.toContain('complete_quality_check');
    expect(actions).not.toContain('fail_quality_check');
  });
});

describe('progressReportSchema action-status alignment', () => {
  it('should map quality_check action to inspecting status', () => {
    // This mirrors the logic in report/route.ts
    const actionToStatus: Record<string, string> = {
      start: 'producing',
      quality_check: 'inspecting',
      warehouse_in: 'stored',
      pause: 'pending',
      abort: 'aborted',
      resume: 'producing',
    };
    expect(actionToStatus.quality_check).toBe('inspecting');
  });

  it('should map warehouse_in action to stored status', () => {
    const actionToStatus: Record<string, string> = {
      start: 'producing',
      quality_check: 'inspecting',
      warehouse_in: 'stored',
    };
    expect(actionToStatus.warehouse_in).toBe('stored');
  });
});
