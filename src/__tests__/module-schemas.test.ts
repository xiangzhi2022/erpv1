import { describe, expect, it } from 'vitest';
import { dealerFormSchema } from '@/app/dealer/schemas';
import {
  WorkshopStatus,
  statusConfig,
  workshopFormSchema,
} from '@/app/factory/workshops/schemas';
import {
  appearanceSchema,
  companySchema,
  passwordSchema,
  unitPriceSettingsSchema,
  profileSchema,
} from '@/app/settings/schemas';

describe('dealerFormSchema', () => {
  const validDealer = {
    name: '华东经销商',
    contactName: '赵六',
    phone: '13800138000',
    region: '上海',
    status: 'active',
    remark: '重点客户',
  };

  it('should validate a complete dealer form', () => {
    expect(dealerFormSchema.safeParse(validDealer).success).toBe(true);
  });

  it('should reject names shorter than 2 chars', () => {
    expect(dealerFormSchema.safeParse({ ...validDealer, name: 'A' }).success).toBe(false);
  });

  it('should accept empty phone but reject malformed phone', () => {
    expect(dealerFormSchema.safeParse({ ...validDealer, phone: '' }).success).toBe(true);
    expect(dealerFormSchema.safeParse({ ...validDealer, phone: '12345' }).success).toBe(false);
  });

  it('should reject unsupported status values', () => {
    expect(dealerFormSchema.safeParse({ ...validDealer, status: 'paused' }).success).toBe(false);
  });
});

describe('workshopFormSchema', () => {
  const validWorkshop = {
    factory_code: 'WH-A01',
    name: '一号车间',
    location: 'A 区',
    manager: '钱七',
    capacity: 100,
    current_load: 20,
    status: 'normal',
    description: '板式家具生产',
  };

  it('should validate a complete workshop form', () => {
    expect(workshopFormSchema.safeParse(validWorkshop).success).toBe(true);
  });

  it('should reject factory codes that do not match the letter-number format', () => {
    expect(workshopFormSchema.safeParse({ ...validWorkshop, factory_code: 'A01' }).success).toBe(false);
    expect(workshopFormSchema.safeParse({ ...validWorkshop, factory_code: 'WH-A01' }).success).toBe(true);
  });

  it('should reject negative or fractional capacity values', () => {
    expect(workshopFormSchema.safeParse({ ...validWorkshop, capacity: -1 }).success).toBe(false);
    expect(workshopFormSchema.safeParse({ ...validWorkshop, current_load: 1.5 }).success).toBe(false);
  });

  it('should have display config for every workshop status', () => {
    for (const status of Object.values(WorkshopStatus)) {
      expect(statusConfig[status].label).toBeTruthy();
      expect(statusConfig[status].color).toBeTruthy();
      expect(statusConfig[status].bgColor).toBeTruthy();
      expect(statusConfig[status].dotColor).toBeTruthy();
    }
  });
});

describe('settings schemas', () => {
  it('should validate profile phone and required nickname', () => {
    const validProfile = {
      nickname: '管理员',
      phone: '13800138000',
      bio: '',
      avatarUrl: '',
    };

    expect(profileSchema.safeParse(validProfile).success).toBe(true);
    expect(profileSchema.safeParse({ ...validProfile, nickname: '' }).success).toBe(false);
    expect(profileSchema.safeParse({ ...validProfile, phone: '12345' }).success).toBe(false);
  });

  it('should require strong password confirmation and reject unchanged password', () => {
    const validPassword = {
      currentPassword: 'old123',
      newPassword: 'new123',
      confirmPassword: 'new123',
    };

    expect(passwordSchema.safeParse(validPassword).success).toBe(true);
    expect(passwordSchema.safeParse({ ...validPassword, confirmPassword: 'other123' }).success).toBe(false);
    expect(
      passwordSchema.safeParse({
        currentPassword: 'same123',
        newPassword: 'same123',
        confirmPassword: 'same123',
      }).success
    ).toBe(false);
    expect(passwordSchema.safeParse({ ...validPassword, newPassword: 'abcdef', confirmPassword: 'abcdef' }).success).toBe(false);
  });

  it('should validate appearance theme choices', () => {
    expect(appearanceSchema.safeParse({ theme: 'light' }).success).toBe(true);
    expect(appearanceSchema.safeParse({ theme: 'dark' }).success).toBe(true);
    expect(appearanceSchema.safeParse({ theme: 'system' }).success).toBe(true);
    expect(appearanceSchema.safeParse({ theme: 'purple' }).success).toBe(false);
  });

  it('should require uppercase company prefixes', () => {
    const validCompany = {
      prefix: 'ERP',
      companyName: '演示公司',
      companyPhone: '',
      companyAddress: '',
    };

    expect(companySchema.safeParse(validCompany).success).toBe(true);
    expect(companySchema.safeParse({ ...validCompany, prefix: 'erp' }).success).toBe(false);
    expect(companySchema.safeParse({ ...validCompany, prefix: 'ERP1' }).success).toBe(false);
    expect(companySchema.safeParse({ ...validCompany, prefix: 'ABCDEFGHIJK' }).success).toBe(false);
  });

  it('should validate unit price rules for material, process, veneer and forming settings', () => {
    const validSettings = {
      rules: [
        {
          id: 'material-18',
          category: 'material_thickness',
          name: '18mm base board',
          thicknessMm: 18,
          unit: 'sqm',
          unitPrice: 168,
          enabled: true,
        },
        {
          id: 'process-mixed-oil',
          category: 'finish',
          name: 'mixed oil',
          finishType: 'mixed_oil',
          unit: 'sqm',
          unitPrice: 95,
          enabled: true,
        },
        {
          id: 'veneer-06',
          category: 'veneer',
          name: '0.6mm veneer',
          finishType: 'veneer',
          veneerThicknessMm: 0.6,
          unit: 'sqm',
          unitPrice: 120,
          enabled: true,
        },
        {
          id: 'forming-pressing',
          category: 'forming',
          name: 'anti-deformation pressing',
          formingMethod: 'pressing',
          unit: 'sqm',
          unitPrice: 210,
          enabled: true,
        },
      ],
    };

    expect(unitPriceSettingsSchema.safeParse(validSettings).success).toBe(true);
  });

  it('should reject invalid unit price rule amounts and category-specific thickness', () => {
    expect(
      unitPriceSettingsSchema.safeParse({
        rules: [
          {
            id: 'bad-price',
            category: 'process',
            name: 'edge detail',
            unit: 'm',
            unitPrice: -1,
            enabled: true,
          },
        ],
      }).success
    ).toBe(false);

    expect(
      unitPriceSettingsSchema.safeParse({
        rules: [
          {
            id: 'bad-veneer',
            category: 'veneer',
            name: 'veneer without thickness',
            finishType: 'veneer',
            unit: 'sqm',
            unitPrice: 80,
            enabled: true,
          },
        ],
      }).success
    ).toBe(false);
  });
});
