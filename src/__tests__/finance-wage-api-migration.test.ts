import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ENTERPRISE_ID = '11111111-1111-4111-8111-111111111111';
const IDEMPOTENCY_KEY = 'finance-wage-test-key';

function mutationHeaders(key = IDEMPOTENCY_KEY) {
  return { 'Idempotency-Key': key };
}

const mocks = vi.hoisted(() => ({
  getEnterpriseContext: vi.fn(),
  requirePermission: vi.fn(),
  createClient: vi.fn(),
  getSupabaseClient: vi.fn(),
  getUserFromRequest: vi.fn(),
  writeStatusLog: vi.fn(),
  rpc: vi.fn(),
  maybeSingleData: null as unknown,
  calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
}));

class Query {
  constructor(private readonly table: string) {}

  select(...args: unknown[]) { mocks.calls.push({ table: this.table, method: 'select', args }); return this; }
  update(...args: unknown[]) { mocks.calls.push({ table: this.table, method: 'update', args }); return this; }
  insert(...args: unknown[]) { mocks.calls.push({ table: this.table, method: 'insert', args }); return this; }
  eq(...args: unknown[]) { mocks.calls.push({ table: this.table, method: 'eq', args }); return this; }
  in(...args: unknown[]) { mocks.calls.push({ table: this.table, method: 'in', args }); return this; }
  order(...args: unknown[]) { mocks.calls.push({ table: this.table, method: 'order', args }); return this; }
  single() { return Promise.resolve({ data: { id: 'record-1' }, error: null }); }
  maybeSingle() { return Promise.resolve({ data: mocks.maybeSingleData, error: null }); }
  then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve({ data: [], error: null }).then(onfulfilled, onrejected);
  }
}

const client = {
  from: vi.fn((table: string) => new Query(table)),
  rpc: mocks.rpc,
};

vi.mock('@/lib/enterprise/context', () => ({
  getEnterpriseContext: mocks.getEnterpriseContext,
  requirePermission: mocks.requirePermission,
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/db/client', () => ({ getSupabaseClient: mocks.getSupabaseClient }));
vi.mock('@/lib/auth', () => ({ getUserFromRequest: mocks.getUserFromRequest }));
vi.mock('@/lib/four-level-order', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/four-level-order')>(),
  canEditFinancialFields: () => true,
  canManageWageRules: () => true,
}));
vi.mock('@/lib/four-level-order-server', () => ({ writeStatusLog: mocks.writeStatusLog }));
vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue({
    allowed: true,
    remaining: 119,
    retryAfterSeconds: 0,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rpc.mockReset();
  mocks.calls.length = 0;
  mocks.maybeSingleData = null;
  mocks.rpc.mockImplementation((functionName) => {
    if (functionName === 'claim_api_idempotency') {
      return Promise.resolve({ data: [{ outcome: 'claimed', response_status: null, response_body: null, claim_token: 'claim-1' }], error: null });
    }
    if (functionName === 'complete_api_idempotency') return Promise.resolve({ data: [], error: null });
    return Promise.resolve({ data: [{ id: 'record-1' }], error: null });
  });
  mocks.getEnterpriseContext.mockResolvedValue({
    enterpriseId: ENTERPRISE_ID,
    userId: 'user-1',
    enterpriseType: 'manufacturer',
    grants: new Set(['finance.read', 'finance.manage', 'wages.manage', 'wages.settle']),
  });
  mocks.createClient.mockResolvedValue(client);
  mocks.getSupabaseClient.mockReturnValue(client);
  mocks.getUserFromRequest.mockResolvedValue({
    id: 'user-1', role: 'factory_finance', tenant_id: ENTERPRISE_ID, tenant_type: 'factory', permissions: [],
  });
});

describe('finance and wage API enterprise boundary', () => {
  it('rejects negative financial pricing before opening a database client', async () => {
    const { PATCH } = await import('@/app/api/finance/orders/[id]/pricing/route');
    const response = await PATCH(new Request('https://erp.example.com/api/finance/orders/order-1/pricing', {
      method: 'PATCH',
      body: JSON.stringify({ total_amount: -1 }),
    }), { params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111112' }) });

    expect(response.status).toBe(422);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it('requires integer cents and delegates pricing updates to the restricted RPC', async () => {
    const { PATCH } = await import('@/app/api/finance/orders/[id]/pricing/route');
    const invalid = await PATCH(new Request('https://erp.example.com/api/finance/orders/order-1/pricing', {
      method: 'PATCH', body: JSON.stringify({ total_amount: 12.5 }),
    }), { params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111112' }) });

    expect(invalid.status).toBe(422);
    expect(mocks.createClient).not.toHaveBeenCalled();

    const valid = await PATCH(new Request('https://erp.example.com/api/finance/orders/order-1/pricing', {
      method: 'PATCH', headers: mutationHeaders(), body: JSON.stringify({ total_amount: 1250, cost_amount: 500 }),
    }), { params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111112' }) });

    expect(valid.status).toBe(200);
    await expect(valid.json()).resolves.toEqual({ success: true, data: { id: 'record-1' } });
    expect(mocks.rpc).toHaveBeenCalledWith('finance_update_order_pricing', {
      target_enterprise_id: ENTERPRISE_ID,
      target_order_id: '11111111-1111-4111-8111-111111111112',
      target_total_amount: 1250,
      target_cost_amount: 500,
      target_profit_amount: null,
      target_deposit_amount: null,
    });
  });

  it('requires an Idempotency-Key before pricing can invoke its business RPC', async () => {
    const { PATCH } = await import('@/app/api/finance/orders/[id]/pricing/route');
    const response = await PATCH(new Request('https://erp.example.com/api/finance/orders/order-1/pricing', {
      method: 'PATCH', body: JSON.stringify({ total_amount: 1250 }),
    }), { params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111112' }) });

    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('replays pricing without invoking its business RPC', async () => {
    mocks.rpc.mockImplementation((functionName) => {
      if (functionName === 'claim_api_idempotency') {
        return Promise.resolve({ data: [{ outcome: 'replay', response_status: 200, response_body: { success: true, data: { id: 'saved' } }, claim_token: null }], error: null });
      }
      return Promise.resolve({ data: [{ id: 'record-1' }], error: null });
    });
    const { PATCH } = await import('@/app/api/finance/orders/[id]/pricing/route');
    const response = await PATCH(new Request('https://erp.example.com/api/finance/orders/order-1/pricing', {
      method: 'PATCH', headers: mutationHeaders('replay-pricing'), body: JSON.stringify({ total_amount: 1250 }),
    }), { params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111112' }) });

    expect(response.status).toBe(200);
    expect(mocks.rpc).not.toHaveBeenCalledWith('finance_update_order_pricing', expect.anything());
  });

  it('uses finance-scoped read RPCs instead of relying on table RLS grants', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [], error: null });
    const { GET: getOrders } = await import('@/app/api/finance/orders/route');
    const orders = await getOrders(new Request('https://erp.example.com/api/finance/orders?status=pending'));

    expect(orders.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('finance_list_order_summaries', {
      target_enterprise_id: ENTERPRISE_ID,
      target_status: 'pending',
    });

    mocks.rpc.mockResolvedValueOnce({ data: [], error: null });
    const { GET: getWages } = await import('@/app/api/finance/wages/route');
    const wages = await getWages(new Request('https://erp.example.com/api/finance/wages?status=approved'));

    expect(wages.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('finance_list_wages', {
      target_enterprise_id: ENTERPRISE_ID,
      target_status: 'approved',
      target_worker_id: null,
    });
  });

  it('reports a conflict when a settlement record is no longer approved', async () => {
    mocks.rpc.mockImplementation((functionName) => {
      if (functionName === 'claim_api_idempotency') {
        return Promise.resolve({ data: [{ outcome: 'claimed', response_status: null, response_body: null, claim_token: 'claim-1' }], error: null });
      }
      if (functionName === 'finance_settle_wage_records') return Promise.resolve({ data: null, error: { code: 'P0001' } });
      return Promise.resolve({ data: [], error: null });
    });
    const { POST } = await import('@/app/api/finance/settlements/route');
    const response = await POST(new Request('https://erp.example.com/api/finance/settlements', {
      method: 'POST', headers: mutationHeaders(),
      body: JSON.stringify({ record_ids: ['11111111-1111-4111-8111-111111111113'] }),
    }));

    expect(response.status).toBe(409);
    expect(mocks.rpc).toHaveBeenCalledWith('finance_settle_wage_records', {
      target_enterprise_id: ENTERPRISE_ID,
      target_record_ids: ['11111111-1111-4111-8111-111111111113'],
    });
  });

  it('rejects duplicate bulk settlement IDs before calling the atomic RPC', async () => {
    const { POST } = await import('@/app/api/finance/settlements/route');
    const recordId = '11111111-1111-4111-8111-111111111113';
    const response = await POST(new Request('https://erp.example.com/api/finance/settlements', {
      method: 'POST', headers: mutationHeaders(), body: JSON.stringify({ record_ids: [recordId, recordId] }),
    }));

    expect(response.status).toBe(422);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('uses the atomic payment RPC instead of a direct wage-record update', async () => {
    const { PATCH } = await import('@/app/api/finance/wage-records/[id]/pay/route');
    const response = await PATCH(new Request('https://erp.example.com/api/finance/wage-records/record-1/pay', {
      method: 'PATCH', headers: mutationHeaders(),
    }), { params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111115' }) });

    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('finance_pay_wage_record', {
      target_enterprise_id: ENTERPRISE_ID,
      target_record_id: '11111111-1111-4111-8111-111111111115',
    });
    expect(mocks.calls.filter((call) => call.table === 'worker_wage_records' && call.method === 'update')).toEqual([]);
  });

  it('does not create a wage rule for a worker outside the active enterprise', async () => {
    const { POST } = await import('@/app/api/wage-rules/route');
    const response = await POST(new Request('https://erp.example.com/api/wage-rules', {
      method: 'POST', headers: mutationHeaders(),
      body: JSON.stringify({
        rule_name: '封边计件',
        task_type: 'board',
        scope_type: 'worker',
        worker_id: '11111111-1111-4111-8111-111111111114',
        unit_price: 10,
      }),
    }));

    expect(response.status).toBe(422);
    expect(mocks.calls).toContainEqual({ table: 'workers', method: 'eq', args: ['enterprise_id', ENTERPRISE_ID] });
    expect(mocks.calls.filter((call) => call.table === 'wage_rules' && call.method === 'insert')).toEqual([]);
  });

  it('replays wage-rule creation without revalidating or writing business rows', async () => {
    mocks.rpc.mockImplementation((functionName) => {
      if (functionName === 'claim_api_idempotency') {
        return Promise.resolve({ data: [{ outcome: 'replay', response_status: 201, response_body: { success: true, data: { id: 'saved-rule' } }, claim_token: null }], error: null });
      }
      return Promise.resolve({ data: [], error: null });
    });
    const { POST } = await import('@/app/api/wage-rules/route');
    const response = await POST(new Request('https://erp.example.com/api/wage-rules', {
      method: 'POST', headers: mutationHeaders('replay-wage-rule'),
      body: JSON.stringify({
        rule_name: '封边计件', task_type: 'board', scope_type: 'worker',
        worker_id: '11111111-1111-4111-8111-111111111114', unit_price: 10,
      }),
    }));

    expect(response.status).toBe(201);
    expect(mocks.calls).toEqual([]);
  });

  it('refuses to modify a paid wage record through the generic PATCH endpoint', async () => {
    mocks.rpc.mockImplementation((functionName) => {
      if (functionName === 'claim_api_idempotency') {
        return Promise.resolve({ data: [{ outcome: 'claimed', response_status: null, response_body: null, claim_token: 'claim-1' }], error: null });
      }
      if (functionName === 'finance_manage_wage_record') return Promise.resolve({ data: [], error: null });
      return Promise.resolve({ data: [], error: null });
    });
    const { PATCH } = await import('@/app/api/wage-records/[id]/route');
    const response = await PATCH(new Request('https://erp.example.com/api/wage-records/record-1', {
      method: 'PATCH', headers: mutationHeaders(), body: JSON.stringify({ expected_status: 'paid', wage_amount: 999 }),
    }), { params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111116' }) });

    expect(response.status).toBe(409);
    expect(mocks.calls.filter((call) => call.table === 'worker_wage_records' && call.method === 'update')).toEqual([]);
    expect(mocks.rpc).toHaveBeenCalledWith('finance_manage_wage_record', {
      target_enterprise_id: ENTERPRISE_ID,
      target_record_id: '11111111-1111-4111-8111-111111111116',
      target_expected_status: 'paid',
      target_status: 'paid',
      target_wage_amount: 999,
      target_quantity: null,
      target_unit_price: null,
    });
  });

  it('rejects a monetary edit when an approved wage is being transitioned', async () => {
    const { PATCH } = await import('@/app/api/wage-records/[id]/route');
    const response = await PATCH(new Request('https://erp.example.com/api/wage-records/record-1', {
      method: 'PATCH', headers: mutationHeaders(), body: JSON.stringify({ expected_status: 'approved', status: 'rejected', wage_amount: 999 }),
    }), { params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111117' }) });

    expect(response.status).toBe(422);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('keeps RPC-only validation and SECURITY DEFINER hardening in the migration', () => {
    const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260823103000_finance_wage_atomic_rpcs.sql'), 'utf8');

    expect(migration).toContain("target_total_amount < 0 or target_total_amount <> trunc(target_total_amount)");
    expect(migration).toContain("target_profit_amount <> trunc(target_profit_amount)");
    expect(migration).toContain("coalesce(cardinality(target_record_ids), 0) not between 1 and 100");
    expect(migration).toContain("target_expected_status = 'approved' and (target_wage_amount is not null or target_quantity is not null or target_unit_price is not null)");
    expect(migration).toContain("approved_by = case when target_status <> 'approved' then null");
    expect(migration).toContain('set search_path = pg_catalog');
    expect(migration).toContain("where rolname = 'v2_function_owner'");
  });
});
