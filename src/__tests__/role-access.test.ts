import { describe, expect, it } from 'vitest';
import {
  canAccessPath,
  getAssignablePermissions,
  getLandingPath,
  getNavigationForUser,
  type AccessUser,
} from '@/lib/role-access';

describe('role access rules', () => {
  it('grants super admin all navigation and assignable permissions', () => {
    const user: AccessUser = { role: 'super_admin', permissions: [] };

    const hrefs = getNavigationForUser(user).map((item) => item.href);

    expect(hrefs).toContain('/settings');
    expect(hrefs).toContain('/orders/exchanges');
    expect(hrefs).toContain('/factory');
    expect(getAssignablePermissions(user).length).toBeGreaterThanOrEqual(18);
  });

  it('limits level-two admins to their own business permission template', () => {
    const factoryAdmin: AccessUser = { role: 'factory_admin', tenant_id: 'factory-1', permissions: [] };
    const dealerAdmin: AccessUser = { role: 'dealer_admin', tenant_id: 'dealer-1', permissions: [] };
    const supplierAdmin: AccessUser = { role: 'supplier_admin', tenant_id: 'supplier-1', permissions: [] };

    expect(getAssignablePermissions(factoryAdmin).map((item) => item.key)).toEqual(
      expect.arrayContaining(['factory_order_manager', 'factory_general_worker'])
    );
    expect(getAssignablePermissions(factoryAdmin).map((item) => item.key)).not.toContain('dealer_order_entry');
    expect(getAssignablePermissions(dealerAdmin).map((item) => item.key)).toEqual(
      expect.arrayContaining(['dealer_order_entry', 'dealer_order_tracker'])
    );
    expect(getAssignablePermissions(supplierAdmin).map((item) => item.key)).toEqual(
      expect.arrayContaining(['supplier_order_receive', 'supplier_order_send'])
    );
  });

  it('builds employee navigation from multiple permissions and fixed landing priority', () => {
    const user: AccessUser = {
      role: 'employee',
      tenant_id: 'dealer-1',
      permissions: ['factory_general_worker', 'dealer_order_tracker'],
    };

    const hrefs = getNavigationForUser(user).map((item) => item.href);

    expect(hrefs).toContain('/worker');
    expect(hrefs).toContain('/progress');
    expect(hrefs).toContain('/orders/exchanges');
    expect(getLandingPath(user)).toBe('/orders/exchanges');
  });

  it('rejects settings and exchange paths without matching permission', () => {
    const accounting: AccessUser = {
      role: 'employee',
      tenant_id: 'dealer-1',
      permissions: ['dealer_accounting'],
    };

    expect(canAccessPath(accounting, '/settings/users')).toBe(false);
    expect(canAccessPath(accounting, '/settings/profile')).toBe(false);
    expect(canAccessPath(accounting, '/profile')).toBe(true);
    expect(canAccessPath(accounting, '/orders')).toBe(true);
    expect(canAccessPath(accounting, '/orders/exchanges')).toBe(false);
  });
});
