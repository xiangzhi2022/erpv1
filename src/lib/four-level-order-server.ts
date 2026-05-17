import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthUser } from '@/lib/auth';
import { getUserPermissionKeys, isSuperAdmin, type PermissionKey } from '@/lib/role-access';
import {
  calculateTaskWage,
  canEditFinancialFields,
  canManageProduction,
  canManageWages,
  canOperateWorkerTask,
  canViewFinancialFields,
  canViewInternalProduction,
  canViewWageSummary,
  externalDealerStatus,
  isDealerSide,
  isWorkerOnly,
  type OrderStatusLogTarget,
} from '@/lib/four-level-order';

export type DbRow = Record<string, unknown>;

export interface OrderTree extends DbRow {
  id: string;
  status?: string | null;
  tenant_id?: string | null;
  target_factory_id?: string | null;
  from_tenant_id?: string | null;
  to_tenant_id?: string | null;
  dealer_id?: string | null;
  spaces: OrderSpaceTree[];
  status_logs: DbRow[];
  external_progress: string;
}

export interface OrderSpaceTree extends DbRow {
  id: string;
  order_id: string;
  products: OrderProductTree[];
}

export interface OrderProductTree extends DbRow {
  id: string;
  order_id: string;
  space_id: string;
  production_tasks: DbRow[];
}

export interface EligibleProductionWorker extends DbRow {
  id: string;
  name?: string | null;
  worker_no?: string | null;
  craft_type?: string | null;
  workshop_id?: string | null;
  score: number;
  match_reasons: string[];
}

const PRODUCTION_PERMISSION_KEYS = [
  'factory_worker',
  'factory_carpenter',
  'factory_polisher',
  'factory_veneer',
  'factory_painter',
  'factory_quality',
  'factory_packer',
  'factory_general_worker',
] as const;

const TASK_MATCHERS = [
  { reason: '开料', needles: ['cut', 'cutting', '开料', '切割', '板件', 'board'], workerTokens: ['cutting', 'cut', '开料', '木工', 'carpenter', 'factory_carpenter'] },
  { reason: '封边', needles: ['edge', 'edgebanding', '封边'], workerTokens: ['edge', '封边', '木工', 'carpenter', 'factory_carpenter'] },
  { reason: '打孔', needles: ['drill', 'hole', '打孔', '钻孔'], workerTokens: ['drill', '打孔', '木工', 'carpenter', 'factory_carpenter'] },
  { reason: '打磨', needles: ['polish', 'sanding', '打磨'], workerTokens: ['polish', '打磨', 'polisher', 'factory_polisher'] },
  { reason: '贴皮', needles: ['veneer', '贴皮'], workerTokens: ['veneer', '贴皮', 'factory_veneer'] },
  { reason: '喷漆', needles: ['paint', '喷漆', '烤漆'], workerTokens: ['paint', '喷漆', 'painter', 'factory_painter'] },
  { reason: '包装', needles: ['package', 'pack', '包装', '打包'], workerTokens: ['package', 'packaging', 'packer', '包装', '打包', 'factory_packer'] },
  { reason: '安装', needles: ['install', '安装', '组装', 'assembly'], workerTokens: ['install', '安装', 'assembly', '组装', 'factory_general_worker'] },
  { reason: '质检', needles: ['quality', 'qc', '质检', '检查'], workerTokens: ['quality', 'qc', '质检', 'factory_quality'] },
];

function valueString(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function valueNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string' && value !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function nowIso(): string {
  return new Date().toISOString();
}

function valueBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return null;
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => normalizeText(item)).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return normalizeTags(parsed);
    } catch {
      // Plain comma/space separated skill tags are common in imported worker rows.
    }
    return value.split(/[,\s，、/|]+/).map((item) => item.trim().toLowerCase()).filter(Boolean);
  }
  if (value && typeof value === 'object') return Object.values(value).flatMap((item) => normalizeTags(item));
  return [];
}

function includesToken(text: string, token: string): boolean {
  return Boolean(token) && text.includes(token.toLowerCase());
}

function taskMatchText(task: DbRow): string {
  return [
    task.task_type,
    task.task_name,
    task.process_name,
    task.task_code,
    task.material,
    task.remark,
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(' ');
}

function workerMatchTokens(worker: DbRow, permissionKeys: readonly string[]): string[] {
  return [
    normalizeText(worker.craft_type),
    normalizeText(worker.position_name),
    normalizeText(worker.role_scope),
    ...normalizeTags(worker.skill_tags),
    ...permissionKeys.map((key) => key.toLowerCase()),
  ].filter(Boolean);
}

export function scoreProductionWorkerForTask(
  worker: DbRow,
  task: DbRow | null | undefined,
  permissionKeys: readonly string[]
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const workerTokens = workerMatchTokens(worker, permissionKeys);
  const workerText = workerTokens.join(' ');

  if (permissionKeys.some((key) => PRODUCTION_PERMISSION_KEYS.includes(key as (typeof PRODUCTION_PERMISSION_KEYS)[number]))) {
    score += 2;
  }
  if (!task) return { score, reasons };

  const text = taskMatchText(task);
  for (const matcher of TASK_MATCHERS) {
    const taskMatches = matcher.needles.some((needle) => includesToken(text, needle));
    if (!taskMatches) continue;
    const workerMatches = matcher.workerTokens.some((token) => includesToken(workerText, token));
    if (workerMatches) {
      score += 20;
      reasons.push(matcher.reason);
    }
  }

  if (worker.craft_type && text && includesToken(text, String(worker.craft_type))) {
    score += 6;
    reasons.push('工种匹配');
  }

  return { score, reasons: Array.from(new Set(reasons)) };
}

function hasProductionPermission(permissionKeys: readonly string[]): boolean {
  return permissionKeys.some((key) => PRODUCTION_PERMISSION_KEYS.includes(key as (typeof PRODUCTION_PERMISSION_KEYS)[number]));
}

function workerHasSkillFallback(worker: DbRow): boolean {
  return Boolean(valueString(worker.craft_type) || normalizeTags(worker.skill_tags).length > 0 || !valueString(worker.user_id));
}

export function canSeeOrder(user: AuthUser, order: DbRow): boolean {
  if (isSuperAdmin(user)) return true;
  if (!user.tenant_id) return false;
  return (
    order.tenant_id === user.tenant_id ||
    order.target_factory_id === user.tenant_id ||
    order.dealer_id === user.tenant_id ||
    order.from_tenant_id === user.tenant_id ||
    order.to_tenant_id === user.tenant_id
  );
}

export function canMutateOrderContent(user: AuthUser, order: DbRow): boolean {
  return canSeeOrder(user, order) && (canManageProduction(user) || canEditFinancialFields(user));
}

export async function getWorkerForUser(supabase: SupabaseClient, user: AuthUser): Promise<DbRow | null> {
  const byUser = await supabase
    .from('workers')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (byUser.data) return byUser.data as DbRow;

  if (!user.phone) return null;
  const byPhone = await supabase
    .from('workers')
    .select('*')
    .eq('phone', user.phone)
    .maybeSingle();
  return (byPhone.data as DbRow | null) || null;
}

async function loadWorkerUserPermissions(
  supabase: SupabaseClient,
  workerRows: DbRow[]
): Promise<Map<string, string[]>> {
  const userIds = Array.from(
    new Set(workerRows.map((worker) => valueString(worker.user_id)).filter((id): id is string => Boolean(id)))
  );
  if (userIds.length === 0) return new Map();
  const { data } = await supabase
    .from('user_permissions')
    .select('user_id, permission_key')
    .in('user_id', userIds);
  const map = new Map<string, string[]>();
  for (const row of ((data || []) as DbRow[])) {
    const userId = valueString(row.user_id);
    const permissionKey = valueString(row.permission_key);
    if (!userId || !permissionKey) continue;
    map.set(userId, [...(map.get(userId) || []), permissionKey]);
  }
  return map;
}

async function loadWorkerUsers(supabase: SupabaseClient, workerRows: DbRow[]): Promise<Map<string, DbRow>> {
  const userIds = Array.from(
    new Set(workerRows.map((worker) => valueString(worker.user_id)).filter((id): id is string => Boolean(id)))
  );
  if (userIds.length === 0) return new Map();
  const { data } = await supabase
    .from('users')
    .select('id, role, tenant_id, tenant_type, is_active')
    .in('id', userIds);
  return new Map(((data || []) as DbRow[]).map((row) => [String(row.id), row]));
}

export async function resolveEligibleProductionWorkers(
  supabase: SupabaseClient,
  user: AuthUser,
  task?: DbRow | null
): Promise<EligibleProductionWorker[]> {
  let query = supabase.from('workers').select('*').eq('status', 'active');
  if (!isSuperAdmin(user) && user.tenant_id) query = query.eq('tenant_id', user.tenant_id);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const workerRows = (data || []) as DbRow[];
  const usersById = await loadWorkerUsers(supabase, workerRows);
  const permissionMap = await loadWorkerUserPermissions(supabase, workerRows);

  return workerRows
    .map((worker) => {
      const linkedUserId = valueString(worker.user_id);
      const linkedUser = linkedUserId ? usersById.get(linkedUserId) || null : null;
      if (linkedUser && valueBoolean(linkedUser.is_active) === false) return null;
      if (!isSuperAdmin(user) && user.tenant_id && worker.tenant_id && worker.tenant_id !== user.tenant_id) return null;
      if (valueBoolean(worker.can_receive_production_task) === false) return null;

      const directPermissions = linkedUserId ? permissionMap.get(linkedUserId) || [] : [];
      const permissions = linkedUser
        ? getUserPermissionKeys({
            role: valueString(linkedUser.role) || undefined,
            tenant_type: valueString(linkedUser.tenant_type) || undefined,
            permissions: directPermissions as PermissionKey[],
          })
        : directPermissions;
      if (!hasProductionPermission(permissions) && !workerHasSkillFallback(worker)) return null;

      const matched = scoreProductionWorkerForTask(worker, task, permissions);
      return {
        ...worker,
        id: String(worker.id),
        name: valueString(worker.name),
        worker_no: valueString(worker.worker_no),
        craft_type: valueString(worker.craft_type),
        workshop_id: valueString(worker.workshop_id),
        score: matched.score,
        match_reasons: matched.reasons,
      } as EligibleProductionWorker;
    })
    .filter((worker): worker is EligibleProductionWorker => Boolean(worker))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.worker_no || a.name || a.id).localeCompare(String(b.worker_no || b.name || b.id), 'zh-CN');
    });
}

export async function ensureWorkerCanReceiveProductionTask(
  supabase: SupabaseClient,
  user: AuthUser,
  workerId: string,
  task: DbRow
): Promise<EligibleProductionWorker> {
  const workers = await resolveEligibleProductionWorkers(supabase, user, task);
  const worker = workers.find((item) => item.id === workerId);
  if (!worker) throw new Error('所选工人当前不可接收该生产任务');
  return worker;
}

export async function canWorkerCalculatePieceWage(
  supabase: SupabaseClient,
  workerId: string
): Promise<boolean> {
  const { data: worker } = await supabase.from('workers').select('*').eq('id', workerId).maybeSingle();
  if (!worker) return false;
  const workerRow = worker as DbRow;
  if (valueString(workerRow.status) !== 'active') return false;
  if (valueBoolean(workerRow.can_calculate_piece_wage) === false) return false;
  const userId = valueString(workerRow.user_id);
  if (!userId) return true;
  const { data: linkedUser } = await supabase
    .from('users')
    .select('id, role, tenant_type, is_active')
    .eq('id', userId)
    .maybeSingle();
  const linkedUserRow = (linkedUser as DbRow | null) || null;
  if (linkedUserRow && valueBoolean(linkedUserRow.is_active) === false) return false;
  const permissionMap = await loadWorkerUserPermissions(supabase, [workerRow]);
  const permissions = getUserPermissionKeys({
    role: valueString(linkedUserRow?.role) || undefined,
    tenant_type: valueString(linkedUserRow?.tenant_type) || undefined,
    permissions: (permissionMap.get(userId) || []) as PermissionKey[],
  });
  return hasProductionPermission(permissions) || workerHasSkillFallback(workerRow);
}

export async function writeStatusLog(
  supabase: SupabaseClient,
  targetType: OrderStatusLogTarget,
  targetId: string,
  fromStatus: string | null | undefined,
  toStatus: string,
  changedBy: string | null | undefined,
  remark?: string | null
): Promise<void> {
  await supabase.from('order_status_logs').insert({
    target_type: targetType,
    target_id: targetId,
    from_status: fromStatus || null,
    to_status: toStatus,
    changed_by: changedBy || null,
    remark: remark || null,
  });
}

async function updateStatus(
  supabase: SupabaseClient,
  table: string,
  targetType: OrderStatusLogTarget,
  id: string | null,
  currentStatus: string | null | undefined,
  nextStatus: string,
  changedBy: string | null | undefined,
  remark?: string
): Promise<void> {
  if (!id || currentStatus === nextStatus) return;
  const { error } = await supabase
    .from(table)
    .update({ status: nextStatus, updated_at: nowIso() })
    .eq('id', id);
  if (!error) await writeStatusLog(supabase, targetType, id, currentStatus, nextStatus, changedBy, remark);
}

export async function loadOrderTree(supabase: SupabaseClient, orderId: string): Promise<OrderTree | null> {
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  if (error || !order) return null;

  const [spacesRes, productsRes, tasksRes, logsRes] = await Promise.all([
    supabase.from('order_spaces').select('*').eq('order_id', orderId).order('sort_order', { ascending: true }),
    supabase.from('order_products').select('*').eq('order_id', orderId).order('sort_order', { ascending: true }),
    supabase.from('production_tasks').select('*').eq('order_id', orderId).order('created_at', { ascending: true }),
    supabase.from('order_status_logs').select('*').in('target_type', ['order', 'space', 'product', 'production_task']).order('changed_at', { ascending: false }).limit(100),
  ]);

  let spaces = (spacesRes.data || []) as DbRow[];
  let products = (productsRes.data || []) as DbRow[];
  const tasks = (tasksRes.data || []) as DbRow[];
  const statusLogs = ((logsRes.data || []) as DbRow[]).filter((log) => {
    const targetId = valueString(log.target_id);
    if (targetId === orderId) return true;
    return tasks.some((task) => task.id === targetId) || spaces.some((space) => space.id === targetId) || products.some((product) => product.id === targetId);
  });

  if (spaces.length === 0) {
    const [modulesRes, itemsRes] = await Promise.all([
      supabase.from('order_modules').select('*').eq('order_id', orderId).order('sort_order', { ascending: true }),
      supabase.from('order_items').select('*').eq('order_id', orderId).order('sort_order', { ascending: true }),
    ]);
    const modules = (modulesRes.data || []) as DbRow[];
    const items = (itemsRes.data || []) as DbRow[];
    spaces = modules.map((module, index) => ({
      id: `legacy-${String(module.id)}`,
      order_id: orderId,
      space_no: valueString(module.module_no) || `${String(order.order_no)}-S${String(index + 1).padStart(2, '0')}`,
      space_name: valueString(module.module_name) || '历史空间',
      space_type: 'legacy',
      sort_order: index + 1,
      status: valueString(order.status) || 'draft',
      remark: module.remark || null,
      legacy: true,
    }));
    products = items.map((item, index) => {
      const moduleId = valueString(item.module_id);
      const legacySpace = spaces.find((space) => String(space.id) === `legacy-${moduleId}`) || spaces[0];
      return {
        id: `legacy-${String(item.id)}`,
        order_id: orderId,
        space_id: legacySpace?.id || 'legacy-space',
        product_no: valueString(item.item_no) || `${String(order.order_no)}-P${String(index + 1).padStart(2, '0')}`,
        product_name: item.product_name,
        product_type: 'custom',
        width: item.width_mm,
        height: item.length_mm,
        depth: item.thickness_mm,
        quantity: item.quantity,
        material: item.specifications,
        color: item.color,
        status: valueString(order.status) || 'draft',
        quoted_amount: item.subtotal,
        cost_amount: 0,
        profit_amount: 0,
        sort_order: index + 1,
        remark: item.remark,
        legacy: true,
      };
    });
  }

  const workerIds = Array.from(
    new Set(
      tasks
        .map((task) => valueString(task.assigned_worker_id) || valueString(task.worker_id))
        .filter((id): id is string => Boolean(id))
    )
  );
  const workersRes = workerIds.length > 0
    ? await supabase.from('workers').select('id, name, worker_no, craft_type, user_id').in('id', workerIds)
    : { data: [] as DbRow[] };
  const workerById = new Map(((workersRes.data || []) as DbRow[]).map((worker) => [String(worker.id), worker]));

  const tasksWithWorkers: DbRow[] = tasks.map((task) => {
    const workerId = valueString(task.assigned_worker_id) || valueString(task.worker_id);
    return {
      ...task,
      worker: workerId ? workerById.get(workerId) || null : null,
    };
  });

  const productTrees = products.map((product) => ({
    ...product,
    id: String(product.id),
    order_id: String(product.order_id || orderId),
    space_id: String(product.space_id),
    production_tasks: tasksWithWorkers.filter((task) => task.product_id === product.id),
  }));

  const spaceTrees = spaces.map((space) => ({
    ...space,
    id: String(space.id),
    order_id: String(space.order_id || orderId),
    products: productTrees.filter((product) => product.space_id === String(space.id)),
  }));

  return {
    ...(order as DbRow),
    id: String((order as DbRow).id),
    spaces: spaceTrees,
    status_logs: statusLogs,
    external_progress: externalDealerStatus(valueString((order as DbRow).status)),
  };
}

export function sanitizeOrderTreeForUser(user: AuthUser, tree: OrderTree): OrderTree {
  const canViewFinancial = canViewFinancialFields(user);
  const canViewWage = canViewWageSummary(user);
  const canViewInternal = canViewInternalProduction(user);
  const dealer = isDealerSide(user);
  const workerOnly = isWorkerOnly(user);

  const sanitizeTask = (task: DbRow): DbRow => {
    const copy: DbRow = { ...task };
    if (!canViewWage) {
      delete copy.wage_rule_id;
      delete copy.estimated_wage_amount;
      delete copy.final_wage_amount;
    }
    if (!canViewInternal) {
      delete copy.assigned_worker_id;
      delete copy.worker_id;
      delete copy.worker;
      delete copy.internal_remark;
      delete copy.remark;
    }
    if (workerOnly) {
      delete copy.worker;
    }
    return copy;
  };

  const sanitizeProduct = (product: OrderProductTree): OrderProductTree => {
    const copy: OrderProductTree = {
      ...product,
      production_tasks: product.production_tasks.map(sanitizeTask),
    };
    if (!canViewFinancial) {
      delete copy.quoted_amount;
      delete copy.cost_amount;
      delete copy.profit_amount;
      delete copy.internal_remark;
    }
    return copy;
  };

  const sanitized: OrderTree = {
    ...tree,
    spaces: tree.spaces.map((space) => ({
      ...space,
      products: space.products.map(sanitizeProduct),
    })),
    status_logs: tree.status_logs,
  };

  if (!canViewFinancial) {
    delete sanitized.cost_amount;
    delete sanitized.profit_amount;
    delete sanitized.internal_remark;
    if (!dealer) delete sanitized.total_amount;
  }

  if (dealer) {
    sanitized.spaces = [];
    sanitized.status_logs = sanitized.status_logs.filter((log) => log.target_type === 'order');
  }

  return sanitized;
}

export async function recomputeParentStatuses(
  supabase: SupabaseClient,
  task: DbRow,
  changedBy: string | null | undefined,
  remark?: string | null
): Promise<void> {
  const orderId = valueString(task.order_id);
  const spaceId = valueString(task.space_id);
  const productId = valueString(task.product_id);
  const taskStatus = valueString(task.status);

  if (taskStatus === 'producing') {
    if (productId) {
      const { data } = await supabase.from('order_products').select('id, status').eq('id', productId).maybeSingle();
      await updateStatus(supabase, 'order_products', 'product', productId, valueString(data?.status), 'producing', changedBy, remark || '任务开始生产');
    }
    if (spaceId) {
      const { data } = await supabase.from('order_spaces').select('id, status').eq('id', spaceId).maybeSingle();
      await updateStatus(supabase, 'order_spaces', 'space', spaceId, valueString(data?.status), 'producing', changedBy, remark || '任务开始生产');
    }
    if (orderId) {
      const { data } = await supabase.from('orders').select('id, status').eq('id', orderId).maybeSingle();
      await updateStatus(supabase, 'orders', 'order', orderId, valueString(data?.status), 'producing', changedBy, remark || '任务开始生产');
    }
  }

  if (taskStatus === 'abnormal') {
    if (productId) {
      const { data } = await supabase.from('order_products').select('id, status').eq('id', productId).maybeSingle();
      await updateStatus(supabase, 'order_products', 'product', productId, valueString(data?.status), 'abnormal', changedBy, remark || '任务异常');
    }
    if (spaceId) {
      const { data } = await supabase.from('order_spaces').select('id, status').eq('id', spaceId).maybeSingle();
      await updateStatus(supabase, 'order_spaces', 'space', spaceId, valueString(data?.status), 'abnormal', changedBy, remark || '任务异常');
    }
    if (orderId) {
      const { data } = await supabase.from('orders').select('id, status').eq('id', orderId).maybeSingle();
      await updateStatus(supabase, 'orders', 'order', orderId, valueString(data?.status), 'abnormal', changedBy, remark || '任务异常');
    }
  }

  if (!orderId || !productId || taskStatus !== 'completed') return;

  const productTasks = await supabase.from('production_tasks').select('id, status').eq('product_id', productId);
  const allProductDone = ((productTasks.data || []) as DbRow[]).length > 0 &&
    ((productTasks.data || []) as DbRow[]).every((row) => row.status === 'completed');
  if (!allProductDone) return;

  const productRes = await supabase.from('order_products').select('id, status').eq('id', productId).maybeSingle();
  await updateStatus(supabase, 'order_products', 'product', productId, valueString(productRes.data?.status), 'completed', changedBy, '产品任务全部完成');

  if (!spaceId) return;
  const spaceProducts = await supabase.from('order_products').select('id, status').eq('space_id', spaceId);
  const allSpaceDone = ((spaceProducts.data || []) as DbRow[]).length > 0 &&
    ((spaceProducts.data || []) as DbRow[]).every((row) => row.status === 'completed');
  if (!allSpaceDone) return;

  const spaceRes = await supabase.from('order_spaces').select('id, status').eq('id', spaceId).maybeSingle();
  await updateStatus(supabase, 'order_spaces', 'space', spaceId, valueString(spaceRes.data?.status), 'completed', changedBy, '空间产品全部完成');

  const orderSpaces = await supabase.from('order_spaces').select('id, status').eq('order_id', orderId);
  const allOrderDone = ((orderSpaces.data || []) as DbRow[]).length > 0 &&
    ((orderSpaces.data || []) as DbRow[]).every((row) => row.status === 'completed');
  if (!allOrderDone) return;

  const orderRes = await supabase.from('orders').select('id, status').eq('id', orderId).maybeSingle();
  await updateStatus(supabase, 'orders', 'order', orderId, valueString(orderRes.data?.status), 'ready_to_ship', changedBy, '订单生产完成，待发货');
}

export async function syncOrderProgressFromTask(
  supabase: SupabaseClient,
  taskId: string,
  changedBy: string | null | undefined,
  remark?: string | null
): Promise<void> {
  const { data } = await supabase.from('production_tasks').select('*').eq('id', taskId).maybeSingle();
  if (!data) return;
  await recomputeParentStatuses(supabase, data as DbRow, changedBy, remark);
}

export async function createOrUpdatePendingWageRecord(
  supabase: SupabaseClient,
  task: DbRow,
  wageRule: DbRow | null,
  changedBy: string
): Promise<DbRow | null> {
  const assignedWorkerId = valueString(task.assigned_worker_id) || valueString(task.worker_id);
  if (!assignedWorkerId || !wageRule) return null;
  const canCalculate = await canWorkerCalculatePieceWage(supabase, assignedWorkerId);
  if (!canCalculate) return null;

  const amount = calculateTaskWage(task, wageRule);
  const taskId = valueString(task.id);
  if (!taskId) return null;

  const record = {
    worker_id: assignedWorkerId,
    order_id: valueString(task.order_id),
    space_id: valueString(task.space_id),
    product_id: valueString(task.product_id),
    task_id: taskId,
    wage_rule_id: valueString(wageRule.id),
    quantity: valueNumber(task.quantity) || 1,
    unit_price: valueNumber(wageRule.unit_price),
    wage_amount: amount,
    status: 'pending',
    submitted_at: nowIso(),
    updated_at: nowIso(),
  };

  const existing = await supabase
    .from('worker_wage_records')
    .select('*')
    .eq('task_id', taskId)
    .maybeSingle();

  if (existing.data) {
    const { data } = await supabase
      .from('worker_wage_records')
      .update(record)
      .eq('id', String((existing.data as DbRow).id))
      .select()
      .single();
    if (data) {
      await writeStatusLog(
        supabase,
        'wage_record',
        String((data as DbRow).id),
        valueString((existing.data as DbRow).status),
        'pending',
        changedBy,
        '任务提交后更新待审核工资'
      );
    }
    return (data as DbRow | null) || null;
  }

  const { data } = await supabase
    .from('worker_wage_records')
    .insert({ ...record, approved_by: null, created_at: nowIso() })
    .select()
    .single();
  await writeStatusLog(supabase, 'production_task', taskId, valueString(task.status), 'submitted', changedBy, '提交任务并生成待审核工资');
  if (data) {
    await writeStatusLog(
      supabase,
      'wage_record',
      String((data as DbRow).id),
      null,
      'pending',
      changedBy,
      '生成待审核工资'
    );
  }
  return (data as DbRow | null) || null;
}

export async function resolveWageRuleForTask(supabase: SupabaseClient, task: DbRow): Promise<DbRow | null> {
  const wageRuleId = valueString(task.wage_rule_id);
  if (wageRuleId) {
    const { data } = await supabase.from('wage_rules').select('*').eq('id', wageRuleId).maybeSingle();
    if (data) return data as DbRow;
  }

  const buildQuery = () => {
    let query = supabase
      .from('wage_rules')
      .select('*')
      .eq('enabled', true)
      .eq('task_type', valueString(task.task_type) || 'process')
      .order('created_at', { ascending: false })
      .limit(1);
    const tenantId = valueString(task.tenant_id);
    if (tenantId) query = query.eq('tenant_id', tenantId);
    return query;
  };

  const processName = valueString(task.process_name);
  if (processName) {
    const exact = await buildQuery().eq('process_name', processName);
    if ((exact.data || []).length > 0) return ((exact.data || []) as DbRow[])[0] || null;
  }

  const { data } = await buildQuery();
  return ((data || []) as DbRow[])[0] || null;
}

export function canAccessProductionTask(user: AuthUser, task: DbRow, worker: DbRow | null): boolean {
  if (canManageProduction(user) || canManageWages(user) || isSuperAdmin(user)) return true;
  if (!canOperateWorkerTask(user) || !worker) return false;
  return task.assigned_worker_id === worker.id || task.worker_id === worker.id;
}
