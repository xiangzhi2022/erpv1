import { describe, expect, it } from 'vitest';
import {
  canCreateOrderInMode,
  getDefaultOrderMode,
  getVisibleOrderModes,
  normalizeOrderMode,
} from '@/lib/order-flow';
import type { AuthUser } from '@/lib/auth';

function user(partial: Partial<AuthUser>): AuthUser {
  return {
    id: 'user-1',
    name: 'Test User',
    role: 'employee',
    permissions: [],
    ...partial,
  };
}

describe('order flow role modes', () => {
  it('routes dealers to dealer orders and factory users to two factory modes', () => {
    expect(getDefaultOrderMode(user({ role: 'dealer_admin', tenant_type: 'dealer' }))).toBe('dealer');
    expect(getVisibleOrderModes(user({ role: 'factory_admin', tenant_type: 'manufacturer' }))).toEqual([
      'factory_received',
      'factory_material',
    ]);
    expect(getDefaultOrderMode(user({ role: 'supplier_admin', tenant_type: 'material_supplier' }))).toBe('supplier_received');
  });

  it('lets dealers create dealer orders and factories create material orders only', () => {
    const dealer = user({ role: 'employee', tenant_type: 'dealer', permissions: ['dealer_order_submitter'] });
    const factory = user({ role: 'employee', tenant_type: 'manufacturer', permissions: ['factory_order_manager'] });
    const supplier = user({ role: 'supplier_admin', tenant_type: 'material_supplier', permissions: ['supplier_order_receive'] });

    expect(canCreateOrderInMode(dealer, 'dealer')).toBe(true);
    expect(canCreateOrderInMode(dealer, 'factory_material')).toBe(false);
    expect(canCreateOrderInMode(factory, 'factory_material')).toBe(true);
    expect(canCreateOrderInMode(factory, 'factory_received')).toBe(false);
    expect(canCreateOrderInMode(supplier, 'supplier_received')).toBe(false);
  });

  it('rejects modes outside the current tenant side', () => {
    const supplier = user({ role: 'supplier_admin', tenant_type: 'material_supplier' });
    expect(normalizeOrderMode('dealer', supplier)).toBeNull();
    expect(normalizeOrderMode('supplier_received', supplier)).toBe('supplier_received');
  });
});
