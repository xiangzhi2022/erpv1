import { describe, it, expect } from 'vitest';
import {
  ORDER_STATUS_CONFIG,
  ORDER_TABS,
  orderFormSchema,
  orderItemSchema,
  formatAmount,
  formatDate,
  formatShortDate,
} from '@/app/orders/schemas';
import type { OrderStatus } from '@/app/orders/schemas';

// ---------------------------------------------------------------------------
// Order status flow — mirrors the business logic in API routes & UI
// ---------------------------------------------------------------------------
const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'returned', 'cancelled'],
  returned: ['pending', 'cancelled'],
  confirmed: ['pool', 'cancelled'],
  pool: ['producing', 'in_production', 'cancelled'],
  producing: ['in_production', 'shipped', 'cancelled'],
  in_production: ['shipped', 'cancelled'],
  shipped: ['completed'],
  completed: [],
  cancelled: [],
};

describe('Order status transitions', () => {
  it('should keep returned orders recoverable only to pending or cancelled', () => {
    expect(ORDER_STATUS_TRANSITIONS.returned).toEqual(['pending', 'cancelled']);
  });

  it('should keep confirmed orders out of direct production', () => {
    expect(ORDER_STATUS_TRANSITIONS.confirmed).not.toContain('producing');
    expect(ORDER_STATUS_TRANSITIONS.confirmed).not.toContain('in_production');
  });

  it('should allow pool to support both current and legacy production status names', () => {
    expect(ORDER_STATUS_TRANSITIONS.pool).toEqual(
      expect.arrayContaining(['producing', 'in_production', 'cancelled'])
    );
  });

  it('should allow pending -> confirmed', () => {
    expect(ORDER_STATUS_TRANSITIONS.pending).toContain('confirmed');
  });

  it('should allow pending -> returned', () => {
    expect(ORDER_STATUS_TRANSITIONS.pending).toContain('returned');
  });

  it('should allow pending -> cancelled', () => {
    expect(ORDER_STATUS_TRANSITIONS.pending).toContain('cancelled');
  });

  it('should allow confirmed -> pool', () => {
    expect(ORDER_STATUS_TRANSITIONS.confirmed).toContain('pool');
  });

  it('should allow pool -> producing', () => {
    expect(ORDER_STATUS_TRANSITIONS.pool).toContain('producing');
  });

  it('should allow producing -> shipped', () => {
    expect(ORDER_STATUS_TRANSITIONS.producing).toContain('shipped');
  });

  it('should allow shipped -> completed', () => {
    expect(ORDER_STATUS_TRANSITIONS.shipped).toContain('completed');
  });

  it('should not allow transitions from completed', () => {
    expect(ORDER_STATUS_TRANSITIONS.completed).toHaveLength(0);
  });

  it('should not allow transitions from cancelled', () => {
    expect(ORDER_STATUS_TRANSITIONS.cancelled).toHaveLength(0);
  });

  it('should cover all statuses defined in ORDER_STATUS_CONFIG', () => {
    const configStatuses = Object.keys(ORDER_STATUS_CONFIG);
    const transitionStatuses = Object.keys(ORDER_STATUS_TRANSITIONS);
    for (const status of configStatuses) {
      expect(transitionStatuses).toContain(status);
    }
  });
});

// ---------------------------------------------------------------------------
// ORDER_STATUS_CONFIG completeness
// ---------------------------------------------------------------------------
describe('ORDER_STATUS_CONFIG', () => {
  it('should have config for every tab status', () => {
    for (const tab of ORDER_TABS) {
      for (const status of tab.statuses) {
        expect(ORDER_STATUS_CONFIG[status as OrderStatus]).toBeDefined();
      }
    }
  });

  it('should have label, color, and dotColor for each status', () => {
    for (const [, config] of Object.entries(ORDER_STATUS_CONFIG)) {
      expect(config.label).toBeTruthy();
      expect(config.color).toBeTruthy();
      expect(config.dotColor).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// ORDER_TABS
// ---------------------------------------------------------------------------
describe('ORDER_TABS', () => {
  it('should have an "all" tab with empty statuses', () => {
    const allTab = ORDER_TABS.find(t => t.value === 'all');
    expect(allTab).toBeDefined();
    expect(allTab!.statuses).toHaveLength(0);
  });

  it('should include producing tab with active production statuses', () => {
    const producingTab = ORDER_TABS.find(t => t.value === 'producing');
    expect(producingTab).toBeDefined();
    expect(producingTab!.statuses).toContain('pool');
    expect(producingTab!.statuses).toContain('producing');
    expect(producingTab!.statuses).not.toContain('in_production');
  });

  it('should have no duplicate statuses across non-all tabs', () => {
    const allStatuses: string[] = [];
    for (const tab of ORDER_TABS) {
      if (tab.value !== 'all') {
        allStatuses.push(...tab.statuses);
      }
    }
    const unique = new Set(allStatuses);
    expect(unique.size).toBe(allStatuses.length);
  });
});

// ---------------------------------------------------------------------------
// orderItemSchema validation
// ---------------------------------------------------------------------------
describe('orderItemSchema', () => {
  const validItem = {
    product_name: '定制衣柜',
    specification: '2000x600x2400mm',
    quantity: 2,
    unit: '套',
    unit_price: 5000,
  };

  it('should validate a valid order item', () => {
    const result = orderItemSchema.safeParse(validItem);
    expect(result.success).toBe(true);
  });

  it('should reject empty product_name', () => {
    const result = orderItemSchema.safeParse({
      ...validItem,
      product_name: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject quantity less than 1', () => {
    const result = orderItemSchema.safeParse({
      ...validItem,
      quantity: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative quantity', () => {
    const result = orderItemSchema.safeParse({
      ...validItem,
      quantity: -1,
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative unit_price', () => {
    const result = orderItemSchema.safeParse({
      ...validItem,
      unit_price: -1,
    });
    expect(result.success).toBe(false);
  });

  it('should reject fractional quantity', () => {
    const result = orderItemSchema.safeParse({
      ...validItem,
      quantity: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it('should coerce string unit_price to number', () => {
    const result = orderItemSchema.safeParse({
      ...validItem,
      unit_price: '12.5',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.unit_price).toBe(12.5);
    }
  });

  it('should accept zero unit_price', () => {
    const result = orderItemSchema.safeParse({
      ...validItem,
      unit_price: 0,
    });
    expect(result.success).toBe(true);
  });

  it('should coerce string quantity to number', () => {
    const result = orderItemSchema.safeParse({
      ...validItem,
      quantity: '5',
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// orderFormSchema validation
// ---------------------------------------------------------------------------
describe('orderFormSchema', () => {
  const validForm = {
    order_no: 'ORD-2024-001',
    customer_name: '张三',
    delivery_date: '2024-12-31',
    remark: '加急',
    items: [
      {
        product_name: '定制衣柜',
        specification: '2000x600x2400mm',
        quantity: 2,
        unit: '套',
        unit_price: 5000,
      },
    ],
  };

  it('should validate a valid order form', () => {
    const result = orderFormSchema.safeParse(validForm);
    expect(result.success).toBe(true);
  });

  it('should reject empty order_no', () => {
    const result = orderFormSchema.safeParse({
      ...validForm,
      order_no: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty customer_name', () => {
    const result = orderFormSchema.safeParse({
      ...validForm,
      customer_name: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty items array', () => {
    const result = orderFormSchema.safeParse({
      ...validForm,
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it('should accept optional fields as empty strings', () => {
    const result = orderFormSchema.safeParse({
      ...validForm,
      delivery_date: '',
      remark: '',
    });
    expect(result.success).toBe(true);
  });

  it('should reject forms when any nested item is invalid', () => {
    const result = orderFormSchema.safeParse({
      ...validForm,
      items: [
        validForm.items[0],
        {
          ...validForm.items[0],
          quantity: 0,
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
describe('formatAmount', () => {
  it('should convert cents to yuan with 2 decimal places', () => {
    expect(formatAmount(50000)).toBe('500.00');
  });

  it('should handle zero amount', () => {
    expect(formatAmount(0)).toBe('0.00');
  });

  it('should handle small amounts', () => {
    expect(formatAmount(99)).toBe('0.99');
  });
});

describe('formatDate', () => {
  it('should return dash for null', () => {
    expect(formatDate(null)).toBe('-');
  });

  it('should format a valid date string', () => {
    const result = formatDate('2024-06-15T10:30:00Z');
    expect(result).toBeTruthy();
    expect(result).not.toBe('-');
  });
});

describe('formatShortDate', () => {
  it('should return dash for null', () => {
    expect(formatShortDate(null)).toBe('-');
  });

  it('should format a valid date string as date only', () => {
    const result = formatShortDate('2024-06-15T10:30:00Z');
    expect(result).toBeTruthy();
    expect(result).not.toBe('-');
  });
});
