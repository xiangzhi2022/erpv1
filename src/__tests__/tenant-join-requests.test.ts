import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import {
  chooseEmployeeProfileWrite,
  normalizePhone,
} from '@/lib/tenant-join-requests';
import { normalizeEmployeeAccountPhone } from '@/lib/employee-management';

describe('tenant join request helpers', () => {
  it('normalizes mainland mobile numbers before using them as employee accounts', () => {
    expect(normalizePhone(' 138-0013-8000 ')).toBe('13800138000');
    expect(normalizeEmployeeAccountPhone(' 138 0013 8000 ')).toBe('13800138000');
    expect(normalizePhone('12345')).toBeNull();
  });

  it('reuses an existing tenant employee profile with the same phone instead of creating a duplicate', () => {
    const write = chooseEmployeeProfileWrite({
      existingByUserId: null,
      existingByPhone: { id: 'employee-1', user_id: null },
      memberUserId: 'user-1',
      enterpriseId: 'tenant-1',
      phone: '13800138000',
      name: 'Alice',
      employeeNo: 'E001',
    });

    expect(write).toEqual({
      action: 'update',
      id: 'employee-1',
      values: expect.objectContaining({
        user_id: 'user-1',
        enterprise_id: 'tenant-1',
        phone: '13800138000',
        status: 'active',
      }),
    });
  });

});
