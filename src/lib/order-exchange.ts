import type { AuthUser } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/role-access';

export type OrderExchangeStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'change_requested'
  | 'rejected'
  | 'cancelled'
  | 'completed';

export type OrderExchangeAction = 'send' | 'accept' | 'request_change' | 'reject' | 'cancel';

export interface OrderExchangeAccessRow {
  from_tenant_id: string;
  to_tenant_id: string;
  status: OrderExchangeStatus;
}

export const ORDER_EXCHANGE_STATUSES: OrderExchangeStatus[] = [
  'draft',
  'sent',
  'accepted',
  'change_requested',
  'rejected',
  'cancelled',
  'completed',
];

export const ORDER_EXCHANGE_STATUS_LABELS: Record<OrderExchangeStatus, string> = {
  draft: '草稿',
  sent: '已发起',
  accepted: '已接受',
  change_requested: '请求修改',
  rejected: '已拒绝',
  cancelled: '已取消',
  completed: '已完成',
};

const TRANSITIONS: Record<OrderExchangeAction, { from: OrderExchangeStatus[]; to: OrderExchangeStatus }> = {
  send: { from: ['draft'], to: 'sent' },
  accept: { from: ['sent', 'change_requested'], to: 'accepted' },
  request_change: { from: ['sent'], to: 'change_requested' },
  reject: { from: ['sent', 'change_requested'], to: 'rejected' },
  cancel: { from: ['draft', 'sent', 'change_requested'], to: 'cancelled' },
};

export function isValidOrderExchangeStatus(status: string): status is OrderExchangeStatus {
  return ORDER_EXCHANGE_STATUSES.includes(status as OrderExchangeStatus);
}

export function canSeeExchange(user: Pick<AuthUser, 'role' | 'tenant_id'>, exchange: OrderExchangeAccessRow): boolean {
  if (isSuperAdmin(user)) return true;
  if (!user.tenant_id) return false;
  return exchange.from_tenant_id === user.tenant_id || exchange.to_tenant_id === user.tenant_id;
}

export function canActOnExchange(user: Pick<AuthUser, 'role' | 'tenant_id'>, exchange: OrderExchangeAccessRow, action: OrderExchangeAction): boolean {
  if (isSuperAdmin(user)) return true;
  if (!user.tenant_id) return false;
  if (action === 'cancel') return exchange.from_tenant_id === user.tenant_id;
  return exchange.to_tenant_id === user.tenant_id;
}

export function nextExchangeStatus(currentStatus: OrderExchangeStatus, action: OrderExchangeAction): OrderExchangeStatus | null {
  const transition = TRANSITIONS[action];
  if (!transition.from.includes(currentStatus)) return null;
  return transition.to;
}
