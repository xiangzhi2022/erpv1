import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUS_CONFIG,
  ORDER_TABS,
  STATUS_TRANSITIONS,
  formatAmount,
  formatDate,
  formatShortDate,
  orderFormSchema,
  orderItemSchema,
  productionTaskDraftSchema,
} from '@/app/orders/schemas';
import type { OrderStatus } from '@/app/orders/schemas';

describe('Order status transitions', () => {
  it('allows pending orders to be received, returned, or cancelled', () => {
    expect(STATUS_TRANSITIONS.pending).toEqual(new Set(['confirmed', 'returned', 'cancelled']));
  });

  it('keeps returned orders recoverable only to pending or cancelled', () => {
    expect(STATUS_TRANSITIONS.returned).toEqual(new Set(['pending', 'cancelled']));
  });

  it('keeps completed and cancelled as terminal states', () => {
    expect(STATUS_TRANSITIONS.completed.size).toBe(0);
    expect(STATUS_TRANSITIONS.cancelled.size).toBe(0);
  });

  it('covers every configured status', () => {
    for (const status of Object.keys(ORDER_STATUS_CONFIG)) {
      expect(STATUS_TRANSITIONS[status]).toBeDefined();
    }
  });
});

describe('ORDER_STATUS_CONFIG', () => {
  it('has config for every tab status', () => {
    for (const tab of ORDER_TABS) {
      for (const status of tab.statuses) {
        expect(ORDER_STATUS_CONFIG[status as OrderStatus]).toBeDefined();
      }
    }
  });

  it('has label, color, and dot color for each status', () => {
    for (const config of Object.values(ORDER_STATUS_CONFIG)) {
      expect(config.label).toBeTruthy();
      expect(config.color).toBeTruthy();
      expect(config.dotColor).toBeTruthy();
    }
  });
});

describe('ORDER_TABS', () => {
  it('has an all tab with empty status list', () => {
    const tab = ORDER_TABS.find((item) => item.value === 'all');
    expect(tab?.statuses).toHaveLength(0);
  });

  it('groups pool and producing under the production tab', () => {
    const tab = ORDER_TABS.find((item) => item.value === 'producing');
    expect(tab?.statuses).toEqual(expect.arrayContaining(['pool', 'producing']));
  });

  it('has no duplicate statuses across non-all tabs', () => {
    const statuses = ORDER_TABS.flatMap((tab) => (tab.value === 'all' ? [] : tab.statuses));
    expect(new Set(statuses).size).toBe(statuses.length);
  });
});

describe('orderItemSchema', () => {
  const validItem = {
    product_name: '定制衣柜',
    product_type: 'wardrobe',
    specification: '2000x600x2400mm',
    material: '多层板',
    woodworking_craft: '免拉手',
    forming_craft: '冷压制',
    painting_craft: '混油',
    length_mm: 2000,
    width_mm: 600,
    thickness_mm: 18,
    quantity: 2,
    unit: '套',
    color: '白色',
    hardware: '铰链',
    hardware_quantity: 4,
    construction_surface: '一面四边',
    unit_price: 5000,
    remark: '',
    attachments: [],
    tasks: [],
  };

  it('validates a complete hierarchical order item', () => {
    expect(orderItemSchema.safeParse(validItem).success).toBe(true);
  });

  it('rejects empty product name', () => {
    expect(orderItemSchema.safeParse({ ...validItem, product_name: '' }).success).toBe(false);
  });

  it('rejects quantity less than one', () => {
    expect(orderItemSchema.safeParse({ ...validItem, quantity: 0 }).success).toBe(false);
  });

  it('rejects fractional quantity', () => {
    expect(orderItemSchema.safeParse({ ...validItem, quantity: 1.5 }).success).toBe(false);
  });

  it('rejects negative unit price', () => {
    expect(orderItemSchema.safeParse({ ...validItem, unit_price: -1 }).success).toBe(false);
  });

  it('coerces string numbers', () => {
    const result = orderItemSchema.safeParse({ ...validItem, quantity: '5', unit_price: '12.5' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(5);
      expect(result.data.unit_price).toBe(12.5);
    }
  });

  it('accepts attachment metadata', () => {
    const result = orderItemSchema.safeParse({
      ...validItem,
      attachments: [{
        file_name: '柜门.jpg',
        file_path: 'order-items/demo/file.jpg',
        file_url: 'https://example.com/file.jpg',
        file_type: 'image/jpeg',
        file_size: 1024,
      }],
    });
    expect(result.success).toBe(true);
  });

  it('accepts fourth-level task drafts', () => {
    const result = orderItemSchema.safeParse({
      ...validItem,
      tasks: [{
        task_type: 'board',
        task_name: '侧板 A',
        quantity: 2,
        unit: '块',
        length_mm: 2400,
        width_mm: 600,
        thickness_mm: 18,
        material: '多层板',
        color: '暖白',
        process_name: '开料',
        construction_surface: '一面四边',
        hardware: '',
        remark: '',
        attachments: [],
      }],
    });
    expect(result.success).toBe(true);
  });
});

describe('productionTaskDraftSchema', () => {
  const validTask = {
    task_type: 'process' as const,
    task_name: '封边任务',
    quantity: 1,
    unit: '项',
    process_name: '封边',
  };

  it('validates a fourth-level production task draft', () => {
    expect(productionTaskDraftSchema.safeParse(validTask).success).toBe(true);
  });

  it('rejects empty task name', () => {
    expect(productionTaskDraftSchema.safeParse({ ...validTask, task_name: '' }).success).toBe(false);
  });

  it('rejects zero quantity', () => {
    expect(productionTaskDraftSchema.safeParse({ ...validTask, quantity: 0 }).success).toBe(false);
  });
});

describe('orderFormSchema', () => {
  const validForm = {
    order_no: 'JX20260513001',
    order_flow: 'dealer_to_factory' as const,
    to_tenant_id: '11111111-1000-4000-8000-000000000001',
    target_factory_id: '11111111-1000-4000-8000-000000000001',
    parent_order_id: '',
    customer_name: '演示工厂一厂有限公司',
    customer_phone: '',
    delivery_date: '2026-05-31',
    remark: '加急',
    modules: [{
      module_name: '主卧室',
      remark: '',
      items: [{
        product_name: '柜门',
        product_type: 'door',
        specification: '',
        material: '木皮',
        woodworking_craft: '免拉手',
        forming_craft: '木皮方向长边',
        painting_craft: '贴皮',
        length_mm: 2200,
        width_mm: 450,
        thickness_mm: 18,
        quantity: 2,
        unit: '件',
        color: '原木色',
        hardware: '铰链',
        hardware_quantity: 4,
        construction_surface: '一面四边',
        unit_price: 120,
        remark: '',
        attachments: [],
        tasks: [],
      }],
    }],
  };

  it('validates a hierarchical dealer-to-factory order form', () => {
    expect(orderFormSchema.safeParse(validForm).success).toBe(true);
  });

  it('validates a factory-to-supplier order form with parent order', () => {
    expect(orderFormSchema.safeParse({
      ...validForm,
      order_flow: 'factory_to_supplier',
      parent_order_id: '11111111-aaaa-4000-8000-000000000001',
      customer_name: '演示供应商木材有限公司',
      to_tenant_id: '11111111-3000-4000-8000-000000000001',
      target_factory_id: '11111111-3000-4000-8000-000000000001',
    }).success).toBe(true);
  });

  it('rejects empty order number and receiver', () => {
    expect(orderFormSchema.safeParse({ ...validForm, order_no: '' }).success).toBe(false);
    expect(orderFormSchema.safeParse({ ...validForm, to_tenant_id: '' }).success).toBe(false);
  });

  it('rejects empty modules', () => {
    expect(orderFormSchema.safeParse({ ...validForm, modules: [] }).success).toBe(false);
  });

  it('rejects modules without product items', () => {
    expect(orderFormSchema.safeParse({
      ...validForm,
      modules: [{ ...validForm.modules[0], items: [] }],
    }).success).toBe(false);
  });

  it('rejects invalid nested product item', () => {
    expect(orderFormSchema.safeParse({
      ...validForm,
      modules: [{
        ...validForm.modules[0],
        items: [{ ...validForm.modules[0].items[0], quantity: 0 }],
      }],
    }).success).toBe(false);
  });

  it('accepts optional fields as empty strings', () => {
    expect(orderFormSchema.safeParse({
      ...validForm,
      customer_phone: '',
      delivery_date: '',
      remark: '',
    }).success).toBe(true);
  });

  it('validates a dealer order with manually entered fourth-level tasks', () => {
    expect(orderFormSchema.safeParse({
      ...validForm,
      modules: [{
        ...validForm.modules[0],
        items: [{
          ...validForm.modules[0].items[0],
          tasks: [{
            task_type: 'hardware',
            task_name: '铰链 / 拉手',
            quantity: 1,
            unit: '套',
            hardware: '铰链、拉手',
            hardware_quantity: 1,
            remark: '',
            attachments: [],
          }],
        }],
      }],
    }).success).toBe(true);
  });
});

describe('formatAmount', () => {
  it('converts cents to yuan with two decimals', () => {
    expect(formatAmount(50000)).toBe('500.00');
  });

  it('handles zero and string amounts', () => {
    expect(formatAmount(0)).toBe('0.00');
    expect(formatAmount('99')).toBe('0.99');
  });
});

describe('formatDate', () => {
  it('returns dash for null', () => {
    expect(formatDate(null)).toBe('-');
    expect(formatShortDate(null)).toBe('-');
  });

  it('formats valid dates', () => {
    expect(formatDate('2024-06-15T10:30:00Z')).not.toBe('-');
    expect(formatShortDate('2024-06-15T10:30:00Z')).not.toBe('-');
  });
});
