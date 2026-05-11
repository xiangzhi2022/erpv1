import { describe, expect, it } from 'vitest';
import {
  canActOnExchange,
  canSeeExchange,
  nextExchangeStatus,
  type OrderExchangeAccessRow,
} from '@/lib/order-exchange';

const exchange: OrderExchangeAccessRow = {
  from_tenant_id: 'dealer-1',
  to_tenant_id: 'factory-1',
  status: 'sent',
};

describe('order exchange rules', () => {
  it('allows both participating tenants to read an exchange', () => {
    expect(canSeeExchange({ role: 'dealer_admin', tenant_id: 'dealer-1' }, exchange)).toBe(true);
    expect(canSeeExchange({ role: 'factory_admin', tenant_id: 'factory-1' }, exchange)).toBe(true);
    expect(canSeeExchange({ role: 'supplier_admin', tenant_id: 'supplier-1' }, exchange)).toBe(false);
  });

  it('allows receiver handling and sender cancellation only', () => {
    expect(canActOnExchange({ role: 'factory_admin', tenant_id: 'factory-1' }, exchange, 'accept')).toBe(true);
    expect(canActOnExchange({ role: 'factory_admin', tenant_id: 'factory-1' }, exchange, 'reject')).toBe(true);
    expect(canActOnExchange({ role: 'factory_admin', tenant_id: 'factory-1' }, exchange, 'request_change')).toBe(true);
    expect(canActOnExchange({ role: 'dealer_admin', tenant_id: 'dealer-1' }, exchange, 'accept')).toBe(false);
    expect(canActOnExchange({ role: 'dealer_admin', tenant_id: 'dealer-1' }, exchange, 'cancel')).toBe(true);
  });

  it('validates status transitions', () => {
    expect(nextExchangeStatus('sent', 'accept')).toBe('accepted');
    expect(nextExchangeStatus('sent', 'request_change')).toBe('change_requested');
    expect(nextExchangeStatus('change_requested', 'reject')).toBe('rejected');
    expect(nextExchangeStatus('accepted', 'reject')).toBeNull();
  });

  it('lets super admin see and handle any exchange', () => {
    expect(canSeeExchange({ role: 'super_admin' }, exchange)).toBe(true);
    expect(canActOnExchange({ role: 'super_admin' }, exchange, 'accept')).toBe(true);
  });
});
