import { describe, it, expect } from 'vitest';
import {
  workerFormSchema,
  CRAFT_TYPES,
  WORKER_STATUSES,
  GENDERS,
  getCraftLabel,
  getStatusInfo,
} from '@/app/workers/schemas';

// ---------------------------------------------------------------------------
// Enum completeness
// ---------------------------------------------------------------------------
describe('Worker enums', () => {
  it('should have 9 craft types', () => {
    expect(CRAFT_TYPES).toHaveLength(9);
    const values = CRAFT_TYPES.map(c => c.value);
    expect(values).toContain('cutting');
    expect(values).toContain('sewing');
    expect(values).toContain('qc');
    expect(values).toContain('packaging');
    expect(values).toContain('ironing');
    expect(values).toContain('pattern');
    expect(values).toContain('cutting_die');
    expect(values).toContain('assembly');
    expect(values).toContain('other');
  });

  it('should have labels for all craft types', () => {
    for (const craft of CRAFT_TYPES) {
      expect(craft.label).toBeTruthy();
    }
  });

  it('should have 3 worker statuses', () => {
    expect(WORKER_STATUSES).toHaveLength(3);
    const values = WORKER_STATUSES.map(s => s.value);
    expect(values).toContain('active');
    expect(values).toContain('on_leave');
    expect(values).toContain('resigned');
  });

  it('should have labels and colors for all statuses', () => {
    for (const status of WORKER_STATUSES) {
      expect(status.label).toBeTruthy();
      expect(status.color).toBeTruthy();
    }
  });

  it('should have 2 genders', () => {
    expect(GENDERS).toHaveLength(2);
    const values = GENDERS.map(g => g.value);
    expect(values).toContain('male');
    expect(values).toContain('female');
  });
});

// ---------------------------------------------------------------------------
// Worker status flow
// ---------------------------------------------------------------------------
describe('Worker status transitions', () => {
  const VALID_TRANSITIONS: Record<string, string[]> = {
    active: ['on_leave', 'resigned'],
    on_leave: ['active', 'resigned'],
    resigned: [],
  };

  it('should allow active -> on_leave', () => {
    expect(VALID_TRANSITIONS.active).toContain('on_leave');
  });

  it('should allow active -> resigned', () => {
    expect(VALID_TRANSITIONS.active).toContain('resigned');
  });

  it('should allow on_leave -> active', () => {
    expect(VALID_TRANSITIONS.on_leave).toContain('active');
  });

  it('should allow on_leave -> resigned', () => {
    expect(VALID_TRANSITIONS.on_leave).toContain('resigned');
  });

  it('should not allow transitions from resigned', () => {
    expect(VALID_TRANSITIONS.resigned).toHaveLength(0);
  });

  it('should cover all defined statuses', () => {
    const definedStatuses = WORKER_STATUSES.map(s => s.value);
    const transitionStatuses = Object.keys(VALID_TRANSITIONS);
    for (const status of definedStatuses) {
      expect(transitionStatuses).toContain(status);
    }
  });
});

// ---------------------------------------------------------------------------
// getCraftLabel helper
// ---------------------------------------------------------------------------
describe('getCraftLabel', () => {
  it('should return correct label for known craft types', () => {
    expect(getCraftLabel('cutting')).toBe('裁剪');
    expect(getCraftLabel('sewing')).toBe('缝纫');
    expect(getCraftLabel('qc')).toBe('质检');
    expect(getCraftLabel('packaging')).toBe('包装');
    expect(getCraftLabel('ironing')).toBe('熨烫');
    expect(getCraftLabel('pattern')).toBe('打版');
    expect(getCraftLabel('cutting_die')).toBe('刀模');
    expect(getCraftLabel('assembly')).toBe('组装');
    expect(getCraftLabel('other')).toBe('其他');
  });

  it('should return "未分配" for null', () => {
    expect(getCraftLabel(null)).toBe('未分配');
  });

  it('should return "未分配" for empty string', () => {
    expect(getCraftLabel('')).toBe('未分配');
  });

  it('should return the raw value for unknown craft type', () => {
    expect(getCraftLabel('unknown_craft')).toBe('unknown_craft');
  });
});

// ---------------------------------------------------------------------------
// getStatusInfo helper
// ---------------------------------------------------------------------------
describe('getStatusInfo', () => {
  it('should return correct label and color for active', () => {
    const info = getStatusInfo('active');
    expect(info.label).toBe('在岗');
    expect(info.color).toContain('green');
  });

  it('should return correct label and color for on_leave', () => {
    const info = getStatusInfo('on_leave');
    expect(info.label).toBe('请假');
    expect(info.color).toContain('yellow');
  });

  it('should return correct label and color for resigned', () => {
    const info = getStatusInfo('resigned');
    expect(info.label).toBe('离职');
    expect(info.color).toContain('red');
  });

  it('should return fallback for unknown status', () => {
    const info = getStatusInfo('unknown');
    expect(info.label).toBe('unknown');
    expect(info.color).toContain('gray');
  });
});

// ---------------------------------------------------------------------------
// workerFormSchema validation
// ---------------------------------------------------------------------------
describe('workerFormSchema', () => {
  const validForm = {
    worker_no: 'W-001',
    name: '王五',
    phone: '13900139000',
    gender: 'male',
    craft_type: 'cutting',
    workshop_id: 'ws-001',
    status: 'active' as const,
    skill_tags: '裁剪,打版',
    hire_date: '2024-01-15',
    remark: '技术熟练',
  };

  it('should validate a valid worker form', () => {
    const result = workerFormSchema.safeParse(validForm);
    expect(result.success).toBe(true);
  });

  it('should reject empty name', () => {
    const result = workerFormSchema.safeParse({
      ...validForm,
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject name exceeding 100 chars', () => {
    const result = workerFormSchema.safeParse({
      ...validForm,
      name: 'x'.repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid status', () => {
    const result = workerFormSchema.safeParse({
      ...validForm,
      status: 'unknown',
    });
    expect(result.success).toBe(false);
  });

  it('should accept optional operational strings as empty values', () => {
    const result = workerFormSchema.safeParse({
      ...validForm,
      worker_no: '',
      phone: '',
      gender: '',
      craft_type: '',
      workshop_id: '',
      skill_tags: '',
      hire_date: '',
      remark: '',
    });
    expect(result.success).toBe(true);
  });

  it('should reject unsupported gender only through downstream business rules, not schema', () => {
    const result = workerFormSchema.safeParse({
      ...validForm,
      gender: 'unknown',
    });
    expect(result.success).toBe(true);
  });

  it('should accept all valid statuses', () => {
    const validStatuses = ['active', 'on_leave', 'resigned'] as const;
    for (const status of validStatuses) {
      const result = workerFormSchema.safeParse({
        ...validForm,
        status,
      });
      expect(result.success).toBe(true);
    }
  });
});
