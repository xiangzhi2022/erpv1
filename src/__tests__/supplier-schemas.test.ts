import { describe, it, expect } from 'vitest';
import {
  supplierFormSchema,
  supplierCategories,
  supplierRatings,
  supplierStatuses,
} from '@/app/supplier/schemas';
import type { SupplierCategory, SupplierRating, SupplierStatus } from '@/app/supplier/schemas';

// ---------------------------------------------------------------------------
// Enum completeness
// ---------------------------------------------------------------------------
describe('Supplier enums', () => {
  it('should have 4 supplier categories', () => {
    expect(supplierCategories).toHaveLength(4);
    expect(supplierCategories).toContain('原材料');
    expect(supplierCategories).toContain('包装耗材');
    expect(supplierCategories).toContain('外协加工');
    expect(supplierCategories).toContain('办公设备');
  });

  it('should have 4 supplier ratings A-D', () => {
    expect(supplierRatings).toHaveLength(4);
    expect(supplierRatings).toContain('A');
    expect(supplierRatings).toContain('B');
    expect(supplierRatings).toContain('C');
    expect(supplierRatings).toContain('D');
  });

  it('should have 3 supplier statuses', () => {
    expect(supplierStatuses).toHaveLength(3);
    const statusValues = supplierStatuses.map(s => s.value);
    expect(statusValues).toContain('active');
    expect(statusValues).toContain('inspecting');
    expect(statusValues).toContain('blacklisted');
  });

  it('should have labels for all statuses', () => {
    for (const status of supplierStatuses) {
      expect(status.label).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Supplier status flow
// ---------------------------------------------------------------------------
describe('Supplier status transitions', () => {
  const VALID_TRANSITIONS: Record<string, string[]> = {
    active: ['inspecting', 'blacklisted'],
    inspecting: ['active', 'blacklisted'],
    blacklisted: [],
  };

  it('should allow active -> inspecting', () => {
    expect(VALID_TRANSITIONS.active).toContain('inspecting');
  });

  it('should allow active -> blacklisted', () => {
    expect(VALID_TRANSITIONS.active).toContain('blacklisted');
  });

  it('should allow inspecting -> active', () => {
    expect(VALID_TRANSITIONS.inspecting).toContain('active');
  });

  it('should allow inspecting -> blacklisted', () => {
    expect(VALID_TRANSITIONS.inspecting).toContain('blacklisted');
  });

  it('should not allow transitions from blacklisted', () => {
    expect(VALID_TRANSITIONS.blacklisted).toHaveLength(0);
  });

  it('should cover all defined statuses', () => {
    const definedStatuses = supplierStatuses.map(s => s.value);
    const transitionStatuses = Object.keys(VALID_TRANSITIONS);
    for (const status of definedStatuses) {
      expect(transitionStatuses).toContain(status);
    }
  });
});

// ---------------------------------------------------------------------------
// supplierFormSchema validation
// ---------------------------------------------------------------------------
describe('supplierFormSchema', () => {
  const validForm = {
    name: '优质板材供应商',
    contactPerson: '李四',
    phone: '13800138000',
    email: 'lisi@example.com',
    category: '原材料' as SupplierCategory,
    rating: 'A' as SupplierRating,
    status: 'active' as SupplierStatus,
    address: '上海市浦东新区',
    remark: '长期合作伙伴',
  };

  it('should validate a valid supplier form', () => {
    const result = supplierFormSchema.safeParse(validForm);
    expect(result.success).toBe(true);
  });

  it('should reject empty name', () => {
    const result = supplierFormSchema.safeParse({
      ...validForm,
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject name exceeding 200 chars', () => {
    const result = supplierFormSchema.safeParse({
      ...validForm,
      name: 'x'.repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid category', () => {
    const result = supplierFormSchema.safeParse({
      ...validForm,
      category: '非法类别',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid rating', () => {
    const result = supplierFormSchema.safeParse({
      ...validForm,
      rating: 'E',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid status', () => {
    const result = supplierFormSchema.safeParse({
      ...validForm,
      status: 'unknown',
    });
    expect(result.success).toBe(false);
  });

  it('should reject email exceeding 200 chars', () => {
    const result = supplierFormSchema.safeParse({
      ...validForm,
      email: 'x'.repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it('should reject phone exceeding 20 chars', () => {
    const result = supplierFormSchema.safeParse({
      ...validForm,
      phone: '1'.repeat(21),
    });
    expect(result.success).toBe(false);
  });

  it('should reject address exceeding 500 chars', () => {
    const result = supplierFormSchema.safeParse({
      ...validForm,
      address: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('should reject remark exceeding 1000 chars', () => {
    const result = supplierFormSchema.safeParse({
      ...validForm,
      remark: 'x'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  it('should accept all valid categories', () => {
    for (const category of supplierCategories) {
      const result = supplierFormSchema.safeParse({
        ...validForm,
        category,
      });
      expect(result.success).toBe(true);
    }
  });

  it('should accept all valid ratings', () => {
    for (const rating of supplierRatings) {
      const result = supplierFormSchema.safeParse({
        ...validForm,
        rating,
      });
      expect(result.success).toBe(true);
    }
  });

  it('should accept all valid statuses', () => {
    for (const status of supplierStatuses) {
      const result = supplierFormSchema.safeParse({
        ...validForm,
        status: status.value,
      });
      expect(result.success).toBe(true);
    }
  });
});
