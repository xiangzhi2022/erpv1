'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, ComponentProps, ReactNode, Ref } from 'react';
import { useFieldArray, useForm, type Resolver, type SubmitHandler, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Check,
  Camera,
  ChevronRight,
  ChevronsUpDown,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Copy,
  Layers3,
  Loader2,
  Package,
  Paperclip,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  Workflow,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { OrderMode } from '@/lib/order-flow';
import {
  CONSTRUCTION_SURFACE_OPTIONS,
  ORDER_MODULE_PRESETS,
  ORDER_UNITS,
  PRODUCTION_TASK_TYPES,
  orderFormSchema,
  type Order,
  type OrderAttachmentFormValues,
  type OrderFormValues,
  type OrderItemFormValues,
  type OrderPageContext,
  type OrderModuleFormValues,
  type ProductionTaskDraftFormValues,
} from '../schemas';

interface CreateOrderDialogProps {
  open: boolean;
  mode: OrderMode;
  partnerLabel: string;
  parentOrders: Order[];
  currentUser?: OrderPageContext['currentUser'];
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type StepId = 'basic' | 'spaces' | 'products' | 'tasks' | 'attachments' | 'confirm';
type CompactStepId = 'basic' | 'structure' | 'attachments' | 'confirm';
type SelectedNode =
  | { type: 'order' }
  | { type: 'space'; moduleIndex: number }
  | { type: 'product'; moduleIndex: number; itemIndex: number }
  | { type: 'task'; moduleIndex: number; itemIndex: number; taskIndex: number };

interface IncompleteNode {
  node: SelectedNode;
  missing: string[];
}

const STEPS: Array<{ id: StepId; label: string; description: string }> = [
  { id: 'basic', label: '基础信息', description: '订单编号、订单名称和交付要求' },
  { id: 'spaces', label: '空间/房间', description: '主卧、厨房、客厅等二级结构' },
  { id: 'products', label: '产品/柜体', description: '衣柜、门板、柜体和基础规格' },
  { id: 'tasks', label: '拆单任务', description: '板件、五金、工序、安装、包装' },
  { id: 'attachments', label: '附件检查', description: '图纸和说明汇总' },
  { id: 'confirm', label: '确认提交', description: '核对结构和金额后提交' },
];

const COMPACT_STEPS: Array<{ id: CompactStepId; label: string; description: string }> = [
  { id: 'basic', label: '基础信息', description: '订单和客户' },
  { id: 'structure', label: '结构录入', description: '空间/产品/拆单任务' },
  { id: 'attachments', label: '附件检查', description: '图纸和说明汇总' },
  { id: 'confirm', label: '确认提交', description: '核对结构' },
];

const PRODUCT_TYPES = [
  { value: 'wardrobe', label: '衣柜' },
  { value: 'cabinet', label: '柜体' },
  { value: 'door', label: '门类' },
  { value: 'hardware', label: '五金' },
  { value: 'countertop', label: '台面' },
  { value: 'custom', label: '自定义' },
];

const PRODUCT_NAME_OPTIONS = [
  '衣柜',
  '地柜',
  '吊柜',
  '鞋柜',
  '酒柜',
  '书柜',
  '床头柜',
  '柜门',
  '门板',
  '侧板',
  '背板',
  '顶板',
  '底板',
  '层板',
  '台面',
  '五金包',
] as const;

const PRODUCT_TYPE_INPUT_OPTIONS = [
  ...PRODUCT_TYPES.map((type) => type.label),
  ...PRODUCT_TYPES.map((type) => type.value),
] as const;

const MATERIAL_OPTIONS = [
  '多层板',
  '颗粒板',
  '密度板',
  '实木',
  '木皮',
  '免漆板',
  '生态板',
  '欧松板',
  '铝合金',
  '岩板',
] as const;

const COLOR_OPTIONS = [
  '暖白',
  '哑光白',
  '原木色',
  '胡桃木',
  '浅灰',
  '深灰',
  '黑色',
  '奶油色',
  '客户指定',
] as const;

const HARDWARE_OPTIONS = [
  '铰链',
  '拉手',
  '滑轨',
  '反弹器',
  '衣通',
  '层板托',
  '连接件',
  '拆装五金',
  '铁件',
] as const;

const HANDLELESS_OPTIONS = ['无', '有'] as const;
const TASK_CRAFT_OPTIONS = ['混油', '薄木皮', '厚木皮'] as const;

const TASK_NAME_OPTIONS = [
  '侧板 A',
  '背板 B',
  '柜门',
  '顶板',
  '底板',
  '层板',
  '开料拆单任务',
  '封边拆单任务',
  '打孔拆单任务',
  '组装拆单任务',
  '包装拆单任务',
  '发货拆单任务',
] as const;

const TASK_TYPE_LABELS: Record<(typeof PRODUCTION_TASK_TYPES)[number], string> = {
  board: '板件',
  door: '门板/房门',
  hardware: '五金',
  process: '工序',
  install: '安装',
  package: '包装',
  delivery: '发货',
};

const SPINNERLESS_NUMBER_INPUT_CLASS = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

const CABINET_DOOR_HINGE_RULES: Array<{ maxHeightMm: number; hingeCount: number }> = [
  { maxHeightMm: 700, hingeCount: 2 },
  { maxHeightMm: 900, hingeCount: 3 },
  { maxHeightMm: 1700, hingeCount: 4 },
  { maxHeightMm: 2200, hingeCount: 5 },
  { maxHeightMm: Number.POSITIVE_INFINITY, hingeCount: 6 },
];

function isCabinetDoorTask(taskName: unknown, taskType: (typeof PRODUCTION_TASK_TYPES)[number] | undefined): boolean {
  if (taskType === 'door') return true;
  if (isBlank(taskName)) return false;
  return /柜门|门板|房门|移门|趟门/.test(String(taskName));
}

function shouldAutoFillHingeHardware(hardware: unknown): boolean {
  if (isBlank(hardware)) return true;
  return /铰链|合页/.test(String(hardware));
}

function hingeCountForDoorHeight(heightMm: number): number | undefined {
  return CABINET_DOOR_HINGE_RULES.find((rule) => heightMm <= rule.maxHeightMm)?.hingeCount;
}

function inferTaskTypeFromTaskName(value: unknown): (typeof PRODUCTION_TASK_TYPES)[number] | undefined {
  if (isBlank(value)) return undefined;
  const name = String(value).trim();
  if (/发货|送货|配送/.test(name)) return 'delivery';
  if (/包装|打包|包裹/.test(name)) return 'package';
  if (/安装|上门|现场/.test(name)) return 'install';
  if (/铰链|拉手|滑轨|合页|螺丝|拉篮|灯带|五金/.test(name)) return 'hardware';
  if (/封边|开料|打孔|组装|工序|油漆|喷漆|加工|拆单/.test(name)) return 'process';
  if (/门板|房门|柜门|移门|趟门/.test(name)) return 'door';
  if (/侧板|背板|层板|顶板|底板|隔板|见光板|封板|板件|柜体/.test(name)) return 'board';
  return 'process';
}

function orderFlowForMode(mode: OrderMode): OrderFormValues['order_flow'] {
  return mode === 'factory_material' ? 'factory_to_supplier' : 'dealer_to_factory';
}

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (typeof value === 'number') return !Number.isFinite(value);
  return String(value).trim().length === 0;
}

function hasPositiveNumber(value: unknown): boolean {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0;
}

function optionalNumberValue(value: unknown): number | undefined {
  if (value === '' || value === null || value === undefined) return undefined;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function confirmIncompleteStep(title: string, messages: string[]): boolean {
  const uniqueMessages = Array.from(new Set(messages)).slice(0, 8);
  toast.warning(title);
  return window.confirm(`${title}\n\n${uniqueMessages.join('\n')}\n\n确定继续下一步吗？`);
}

function productIncompleteMessages(modules: OrderModuleFormValues[]): string[] {
  const messages: string[] = [];
  modules.forEach((module, moduleIndex) => {
    module.items.forEach((item, itemIndex) => {
      const label = `${module.module_name || `空间 #${moduleIndex + 1}`} / ${item.product_name || `产品 #${itemIndex + 1}`}`;
      const missing: string[] = [];
      if (isBlank(item.product_type)) missing.push('产品类型');
      if (!hasPositiveNumber(item.quantity)) missing.push('数量');
      if (isBlank(item.unit)) missing.push('单位');
      if (missing.length > 0) messages.push(`${label}：${missing.join('、')}未完整`);
    });
  });
  return messages;
}

function taskIncompleteMessages(modules: OrderModuleFormValues[]): string[] {
  const messages: string[] = [];
  modules.forEach((module, moduleIndex) => {
    module.items.forEach((item, itemIndex) => {
      const productLabel = `${module.module_name || `空间 #${moduleIndex + 1}`} / ${item.product_name || `产品 #${itemIndex + 1}`}`;
      if (item.tasks.length === 0) {
        messages.push(`${productLabel}：还没有录入拆单任务`);
        return;
      }
      item.tasks.forEach((task, taskIndex) => {
        const label = `${productLabel} / ${task.task_name || `拆单任务 #${taskIndex + 1}`}`;
        const missing: string[] = [];
        if (isBlank(task.unit)) missing.push('单位');
        if ((task.task_type === 'board' || task.task_type === 'door') && (
          !hasPositiveNumber(task.length_mm)
          || !hasPositiveNumber(task.width_mm)
          || !hasPositiveNumber(task.thickness_mm)
        )) {
          missing.push('长宽厚尺寸');
        }
        if ((task.task_type === 'board' || task.task_type === 'door' || task.task_type === 'process') && isBlank(task.material)) {
          missing.push('材质');
        }
        if ((task.task_type === 'board' || task.task_type === 'door') && isBlank(task.color)) missing.push('颜色');
        if (task.task_type === 'hardware' && isBlank(task.hardware)) missing.push('五金');
        if (missing.length > 0) messages.push(`${label}：${missing.join('、')}未完整`);
      });
    });
  });
  return messages;
}

function defaultTask(overrides: Partial<ProductionTaskDraftFormValues> = {}): ProductionTaskDraftFormValues {
  return {
    task_type: 'process',
    task_name: '',
    task_code: '',
    quantity: 1,
    unit: '件',
    length_mm: undefined,
    width_mm: undefined,
    thickness_mm: undefined,
    area: undefined,
    material: '',
    handleless: '无',
    craft: '',
    color: '',
    process_name: '',
    construction_surface: '',
    unit_price: undefined,
    subtotal: undefined,
    hardware: '',
    hardware_quantity: undefined,
    remark: '',
    attachments: [],
    ...overrides,
  };
}

function defaultItem(): OrderItemFormValues {
  return {
    product_name: '',
    product_type: '柜体',
    specification: '',
    material: '',
    woodworking_craft: '',
    forming_craft: '',
    painting_craft: '',
    length_mm: undefined,
    width_mm: undefined,
    thickness_mm: undefined,
    quantity: 1,
    unit: '件',
    color: '',
    hardware: '',
    hardware_quantity: undefined,
    construction_surface: '',
    unit_price: 0,
    remark: '',
    attachments: [],
    tasks: [],
  };
}

function defaultModule(name = '主卧室'): OrderModuleFormValues {
  return {
    module_name: name,
    remark: '',
    items: [defaultItem()],
  };
}

function emptyForm(mode: OrderMode): OrderFormValues {
  return {
    order_no: '',
    order_flow: orderFlowForMode(mode),
    to_tenant_id: '',
    target_factory_id: '',
    parent_order_id: '',
    existing_order_id: '',
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    delivery_date: '',
    remark: '',
    modules: [defaultModule()],
  };
}

function countProducts(modules: OrderModuleFormValues[]): number {
  return modules.reduce((sum, module) => sum + module.items.length, 0);
}

function countTasks(modules: OrderModuleFormValues[]): number {
  return modules.reduce((sum, module) => (
    sum + module.items.reduce((itemSum, item) => itemSum + item.tasks.length, 0)
  ), 0);
}

function hasProductEntry(item: OrderItemFormValues): boolean {
  const hasTextValue = [
    item.product_name,
    item.specification,
    item.material,
    item.woodworking_craft,
    item.forming_craft,
    item.painting_craft,
    item.color,
    item.hardware,
    item.construction_surface,
    item.remark,
  ].some((value) => !isBlank(value));
  const hasSizeValue = [item.length_mm, item.width_mm, item.thickness_mm, item.hardware_quantity].some((value) => hasPositiveNumber(value));
  return hasTextValue || hasSizeValue || item.attachments.length > 0;
}

function hasTaskEntry(task: ProductionTaskDraftFormValues): boolean {
  const hasTextValue = [
    task.task_name,
    task.task_code,
    task.material,
    task.color,
    task.process_name,
    task.construction_surface,
    task.hardware,
    task.remark,
  ].some((value) => !isBlank(value));
  const hasSizeValue = [task.length_mm, task.width_mm, task.thickness_mm, task.area, task.hardware_quantity].some((value) => hasPositiveNumber(value));
  return hasTextValue || hasSizeValue || task.attachments.length > 0;
}

function countConstructionEntries(modules: OrderModuleFormValues[]): number {
  return modules.reduce((sum, module) => (
    sum + module.items.reduce((itemSum, item) => {
      const taskCount = item.tasks.filter(hasTaskEntry).length;
      if (taskCount > 0) return itemSum + taskCount;
      return itemSum + (hasProductEntry(item) ? 1 : 0);
    }, 0)
  ), 0);
}

function countAttachments(modules: OrderModuleFormValues[]): number {
  return modules.reduce((sum, module) => (
    sum + module.items.reduce((itemSum, item) => itemSum + item.attachments.length, 0)
  ), 0);
}

function selectedNodeKey(node: SelectedNode): string {
  if (node.type === 'order') return 'order';
  if (node.type === 'space') return `space:${node.moduleIndex}`;
  if (node.type === 'product') return `product:${node.moduleIndex}:${node.itemIndex}`;
  return `task:${node.moduleIndex}:${node.itemIndex}:${node.taskIndex}`;
}

function compactStepForStep(step: StepId): CompactStepId {
  if (step === 'attachments' || step === 'confirm') return step;
  if (step === 'basic') return 'basic';
  return 'structure';
}

function missingForOrder(values: OrderFormValues): string[] {
  const missing: string[] = [];
  if (isBlank(values.order_no)) missing.push('订单编号');
  if (isBlank(values.customer_name)) missing.push('订单名称');
  return missing;
}

function missingForSpace(module: OrderModuleFormValues | undefined): string[] {
  const missing: string[] = [];
  if (!module || isBlank(module.module_name)) missing.push('空间名称');
  return missing;
}

function missingForProduct(item: OrderItemFormValues | undefined): string[] {
  const missing: string[] = [];
  if (!item || isBlank(item.product_name)) missing.push('产品名称');
  if (!item || isBlank(item.product_type)) missing.push('产品类型');
  if (!item || !hasPositiveNumber(item.quantity)) missing.push('数量');
  if (!item || isBlank(item.unit)) missing.push('单位');
  return missing;
}

function missingForTask(task: ProductionTaskDraftFormValues | undefined): string[] {
  const missing: string[] = [];
  if (!task || isBlank(task.task_name)) missing.push('拆单任务名称');
  if (!task || !hasPositiveNumber(task.quantity)) missing.push('数量');
  if (!task || isBlank(task.unit)) missing.push('单位');
  return missing;
}

function collectIncompleteNodes(values: OrderFormValues): IncompleteNode[] {
  const nodes: IncompleteNode[] = [];
  const orderMissing = missingForOrder(values);
  if (orderMissing.length > 0) nodes.push({ node: { type: 'order' }, missing: orderMissing });
  values.modules.forEach((module, moduleIndex) => {
    const spaceMissing = missingForSpace(module);
    if (spaceMissing.length > 0) nodes.push({ node: { type: 'space', moduleIndex }, missing: spaceMissing });
    module.items.forEach((item, itemIndex) => {
      const productMissing = missingForProduct(item);
      if (productMissing.length > 0) nodes.push({ node: { type: 'product', moduleIndex, itemIndex }, missing: productMissing });
      if (item.tasks.length === 0) {
        nodes.push({ node: { type: 'product', moduleIndex, itemIndex }, missing: ['拆单任务'] });
      }
      item.tasks.forEach((task, taskIndex) => {
        const taskMissing = missingForTask(task);
        if (taskMissing.length > 0) nodes.push({ node: { type: 'task', moduleIndex, itemIndex, taskIndex }, missing: taskMissing });
      });
    });
  });
  return nodes;
}

function mergeIncompleteNodes(nodes: IncompleteNode[]): IncompleteNode[] {
  const merged = new Map<string, IncompleteNode>();
  nodes.forEach((item) => {
    const key = selectedNodeKey(item.node);
    const current = merged.get(key);
    if (!current) {
      merged.set(key, { node: item.node, missing: Array.from(new Set(item.missing)) });
      return;
    }
    current.missing = Array.from(new Set([...current.missing, ...item.missing]));
  });
  return Array.from(merged.values());
}

function normalizeSelectedNode(node: SelectedNode, modules: OrderModuleFormValues[]): SelectedNode {
  if (node.type === 'order') return node;
  const orderModule = modules[node.moduleIndex];
  if (!orderModule) return { type: 'order' };
  if (node.type === 'space') return node;
  const item = orderModule.items[node.itemIndex];
  if (!item) return { type: 'space', moduleIndex: node.moduleIndex };
  if (node.type === 'product') return node;
  if (!item.tasks[node.taskIndex]) return { type: 'product', moduleIndex: node.moduleIndex, itemIndex: node.itemIndex };
  return node;
}

function firstProductNode(modules: OrderModuleFormValues[], moduleIndex = 0): SelectedNode {
  const preferredModule = modules[moduleIndex];
  if (preferredModule?.items[0]) return { type: 'product', moduleIndex, itemIndex: 0 };
  for (let nextModuleIndex = 0; nextModuleIndex < modules.length; nextModuleIndex += 1) {
    if (modules[nextModuleIndex]?.items[0]) {
      return { type: 'product', moduleIndex: nextModuleIndex, itemIndex: 0 };
    }
  }
  return modules[0] ? { type: 'space', moduleIndex: 0 } : { type: 'order' };
}

function firstTaskOrProductNode(modules: OrderModuleFormValues[], moduleIndex = 0, itemIndex = 0): SelectedNode {
  const preferredItem = modules[moduleIndex]?.items[itemIndex];
  if (preferredItem?.tasks[0]) return { type: 'task', moduleIndex, itemIndex, taskIndex: 0 };
  if (preferredItem) return { type: 'product', moduleIndex, itemIndex };

  for (let nextModuleIndex = 0; nextModuleIndex < modules.length; nextModuleIndex += 1) {
    const items = modules[nextModuleIndex]?.items || [];
    for (let nextItemIndex = 0; nextItemIndex < items.length; nextItemIndex += 1) {
      if (items[nextItemIndex]?.tasks[0]) {
        return { type: 'task', moduleIndex: nextModuleIndex, itemIndex: nextItemIndex, taskIndex: 0 };
      }
    }
  }
  return firstProductNode(modules, moduleIndex);
}

function nodeForStep(step: StepId, modules: OrderModuleFormValues[], currentNode: SelectedNode): SelectedNode {
  const normalized = normalizeSelectedNode(currentNode, modules);
  if (step === 'basic') return { type: 'order' };
  if (step === 'spaces') {
    if (normalized.type !== 'order') return { type: 'space', moduleIndex: normalized.moduleIndex };
    return modules[0] ? { type: 'space', moduleIndex: 0 } : { type: 'order' };
  }
  if (step === 'products') {
    if (normalized.type === 'product') return normalized;
    if (normalized.type === 'task') return { type: 'product', moduleIndex: normalized.moduleIndex, itemIndex: normalized.itemIndex };
    if (normalized.type === 'space') return firstProductNode(modules, normalized.moduleIndex);
    return firstProductNode(modules);
  }
  if (step === 'tasks') {
    if (normalized.type === 'task') return normalized;
    if (normalized.type === 'product') return firstTaskOrProductNode(modules, normalized.moduleIndex, normalized.itemIndex);
    if (normalized.type === 'space') return firstTaskOrProductNode(modules, normalized.moduleIndex, 0);
    return firstTaskOrProductNode(modules);
  }
  return normalized;
}

function cloneModules(modules: OrderModuleFormValues[]): OrderModuleFormValues[] {
  return JSON.parse(JSON.stringify(modules)) as OrderModuleFormValues[];
}

export function CreateOrderDialog({
  open,
  mode,
  parentOrders,
  currentUser,
  onOpenChange,
  onSuccess,
}: CreateOrderDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [generatingOrderNo, setGeneratingOrderNo] = useState(false);
  const [savingBasicOrder, setSavingBasicOrder] = useState(false);
  const [savedOrderId, setSavedOrderId] = useState('');
  const [activeStep, setActiveStep] = useState<StepId>('basic');
  const [selectedNode, setSelectedNode] = useState<SelectedNode>({ type: 'order' });

  const form = useForm<OrderFormValues, unknown, OrderFormValues>({
    resolver: zodResolver(orderFormSchema) as unknown as Resolver<OrderFormValues>,
    defaultValues: emptyForm(mode),
  });

  const modules = useFieldArray({
    control: form.control,
    name: 'modules',
  });

  const watchedValues = form.watch();
  const watchedModules = watchedValues.modules;
  const activeStepIndex = STEPS.findIndex((step) => step.id === activeStep);
  const compactStep = compactStepForStep(activeStep);
  const recorderName = currentUser?.name || currentUser?.phone || '';
  const normalizedSelectedNode = normalizeSelectedNode(selectedNode, watchedModules);
  const incompleteNodes = mergeIncompleteNodes(collectIncompleteNodes(watchedValues));
  const incompleteCount = incompleteNodes.length;

  const totalAmount = useMemo(() => {
    return watchedModules.reduce((sum, module) => {
      return sum + module.items.reduce((itemSum, item) => {
        return itemSum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
      }, 0);
    }, 0);
  }, [watchedModules]);

  const selectStructureNode = useCallback((node: SelectedNode) => {
    setSelectedNode(node);
    if (node.type === 'order') {
      setActiveStep('basic');
      return;
    }
    if (node.type === 'space') {
      setActiveStep('spaces');
      return;
    }
    setActiveStep(node.type === 'product' ? 'products' : 'tasks');
  }, []);

  const activateStep = useCallback((step: StepId) => {
    const modulesSnapshot = form.getValues('modules') || [];
    const nextNode = nodeForStep(step, modulesSnapshot, selectedNode);
    setSelectedNode(nextNode);
    setActiveStep(step);
  }, [form, selectedNode]);

  const updateModules = useCallback((updater: (modules: OrderModuleFormValues[]) => OrderModuleFormValues[], nextNode?: SelectedNode) => {
    const nextModules = updater(cloneModules(form.getValues('modules') || []));
    form.setValue('modules', nextModules, { shouldDirty: true, shouldValidate: true });
    if (nextNode) selectStructureNode(normalizeSelectedNode(nextNode, nextModules));
  }, [form, selectStructureNode]);

  const generateOrderNo = useCallback(async () => {
    setGeneratingOrderNo(true);
    try {
      const prefixRes = await fetch('/api/orders/prefix');
      const prefixData = await prefixRes.json().catch(() => ({}));
      const prefix = prefixData.prefix || prefixData.data?.prefix || (mode === 'factory_material' ? 'CL' : 'JX');
      const response = await fetch('/api/orders/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix }),
      });
      const data = await response.json();
      if (data.success) {
        form.setValue('order_no', data.data?.order_no || data.orderNo || '');
      }
    } finally {
      setGeneratingOrderNo(false);
    }
  }, [form, mode]);

  useEffect(() => {
    if (!open) return;
    form.reset(emptyForm(mode));
    setSavedOrderId('');
    setActiveStep('basic');
    setSelectedNode({ type: 'order' });
    generateOrderNo();
  }, [form, generateOrderNo, mode, open]);

  useEffect(() => {
    const normalized = normalizeSelectedNode(selectedNode, watchedModules);
    if (selectedNodeKey(normalized) !== selectedNodeKey(selectedNode)) {
      selectStructureNode(normalized);
    }
  }, [selectStructureNode, selectedNode, watchedModules]);

  const addSpace = () => {
    const nextIndex = (form.getValues('modules') || []).length;
    updateModules((current) => {
      current.push(defaultModule('自定义空间'));
      return current;
    }, { type: 'space', moduleIndex: nextIndex });
  };

  const addSpaceAfter = (moduleIndex: number) => {
    updateModules((current) => {
      current.splice(moduleIndex + 1, 0, defaultModule('自定义空间'));
      return current;
    }, { type: 'space', moduleIndex: moduleIndex + 1 });
  };

  const removeSpace = (moduleIndex: number) => {
    if (watchedModules.length <= 1) {
      toast.error('至少保留一个空间');
      return;
    }
    modules.remove(moduleIndex);
    selectStructureNode({ type: 'space', moduleIndex: Math.max(0, moduleIndex - 1) });
  };

  const addProduct = (moduleIndex: number) => {
    const itemIndex = watchedModules[moduleIndex]?.items.length || 0;
    updateModules((current) => {
      current[moduleIndex]?.items.push(defaultItem());
      return current;
    }, { type: 'product', moduleIndex, itemIndex });
  };

  const copyProduct = (moduleIndex: number, itemIndex: number) => {
    const source = watchedModules[moduleIndex]?.items[itemIndex];
    if (!source) return;
    updateModules((current) => {
      const copied = cloneModules([{ module_name: '', remark: '', items: [source] }])[0].items[0];
      copied.product_name = `${copied.product_name || `产品 #${itemIndex + 1}`} 副本`;
      current[moduleIndex]?.items.splice(itemIndex + 1, 0, copied);
      return current;
    }, { type: 'product', moduleIndex, itemIndex: itemIndex + 1 });
  };

  const removeProduct = (moduleIndex: number, itemIndex: number) => {
    const items = watchedModules[moduleIndex]?.items || [];
    if (items.length <= 1) {
      toast.error('每个空间至少保留一个产品');
      return;
    }
    updateModules((current) => {
      current[moduleIndex]?.items.splice(itemIndex, 1);
      return current;
    }, { type: 'product', moduleIndex, itemIndex: Math.max(0, itemIndex - 1) });
  };

  const addTask = (moduleIndex: number, itemIndex: number, task?: ProductionTaskDraftFormValues) => {
    const taskIndex = watchedModules[moduleIndex]?.items[itemIndex]?.tasks.length || 0;
    updateModules((current) => {
      current[moduleIndex]?.items[itemIndex]?.tasks.push(task || defaultTask());
      return current;
    }, { type: 'task', moduleIndex, itemIndex, taskIndex });
  };

  const addTaskInline = (moduleIndex: number) => {
    updateModules((current) => {
      const orderModule = current[moduleIndex];
      if (!orderModule) return current;
      if (orderModule.items.length === 0) orderModule.items.push(defaultItem());
      orderModule.items[0]?.tasks.push(defaultTask());
      return current;
    }, { type: 'space', moduleIndex });
  };

  const addTaskAfter = (moduleIndex: number, itemIndex: number, taskIndex: number) => {
    updateModules((current) => {
      current[moduleIndex]?.items[itemIndex]?.tasks.splice(taskIndex + 1, 0, defaultTask());
      return current;
    }, { type: 'task', moduleIndex, itemIndex, taskIndex: taskIndex + 1 });
  };

  const copyTask = (moduleIndex: number, itemIndex: number, taskIndex: number) => {
    const source = watchedModules[moduleIndex]?.items[itemIndex]?.tasks[taskIndex];
    if (!source) return;
    updateModules((current) => {
      const copied = JSON.parse(JSON.stringify(source)) as ProductionTaskDraftFormValues;
      copied.task_name = `${copied.task_name || `拆单任务 #${taskIndex + 1}`} 副本`;
      current[moduleIndex]?.items[itemIndex]?.tasks.splice(taskIndex + 1, 0, copied);
      return current;
    }, { type: 'task', moduleIndex, itemIndex, taskIndex: taskIndex + 1 });
  };

  const removeTask = (moduleIndex: number, itemIndex: number, taskIndex: number) => {
    updateModules((current) => {
      current[moduleIndex]?.items[itemIndex]?.tasks.splice(taskIndex, 1);
      return current;
    }, { type: 'product', moduleIndex, itemIndex });
  };

  const removeTaskInline = (moduleIndex: number, itemIndex: number, taskIndex: number) => {
    updateModules((current) => {
      current[moduleIndex]?.items[itemIndex]?.tasks.splice(taskIndex, 1);
      return current;
    }, { type: 'space', moduleIndex });
  };

  const saveBasicOrder = async () => {
    const valid = await form.trigger(['order_no', 'customer_name']);
    if (!valid) {
      toast.error('请先填写订单编号和订单名称');
      return;
    }

    setSavingBasicOrder(true);
    try {
      const values = form.getValues();
      const response = await fetch('/api/orders/basic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          existing_order_id: savedOrderId || undefined,
          order_no: values.order_no,
          order_flow: values.order_flow,
          parent_order_id: values.parent_order_id,
          customer_name: values.customer_name,
          customer_phone: values.customer_phone,
          customer_address: values.customer_address,
          delivery_date: values.delivery_date,
          remark: values.remark,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSavedOrderId(data.data?.id || '');
        onSuccess();
        toast.success('订单已保存，可继续录入结构');
        await goToStep('spaces');
      } else {
        toast.error(data.error || '保存订单失败');
      }
    } catch {
      toast.error('保存订单失败，请重试');
    } finally {
      setSavingBasicOrder(false);
    }
  };

  const validateStep = async (step: StepId): Promise<boolean> => {
    if (step === 'basic') {
      const valid = await form.trigger(['order_no', 'customer_name']);
      if (!valid) toast.error('请先填写订单编号和订单名称');
      return valid;
    }
    if (step === 'spaces') {
      const firstMissingSpaceIndex = watchedModules.findIndex((module) => isBlank(module.module_name));
      const valid = watchedModules.length > 0 && firstMissingSpaceIndex === -1;
      if (!valid) {
        if (firstMissingSpaceIndex >= 0) selectStructureNode({ type: 'space', moduleIndex: firstMissingSpaceIndex });
        toast.error('请至少录入一个空间/房间名称');
      }
      return valid;
    }
    if (step === 'products') {
      const currentValues = form.getValues();
      const currentModules = currentValues.modules || [];
      const productMissingNodes = mergeIncompleteNodes(collectIncompleteNodes(currentValues)).filter((item) => item.node.type === 'product');
      const valid = currentModules.every((module) => (
        module.items.length > 0
        && module.items.every((item) => (
          !isBlank(item.product_name)
          && hasPositiveNumber(item.quantity)
          && !isBlank(item.unit)
        ))
      ));
      if (!valid) {
        const firstProductMissing = productMissingNodes[0];
        if (firstProductMissing) {
          selectStructureNode(firstProductMissing.node);
          toast.warning(`产品缺少：${firstProductMissing.missing.join('、')}`);
        } else {
          toast.error('每个空间至少需要一个产品，并填写产品名称、数量和单位');
        }
        return false;
      }
      const incompleteMessages = productIncompleteMessages(currentModules);
      if (incompleteMessages.length > 0) {
        const firstProductMissing = productMissingNodes[0];
        if (firstProductMissing) selectStructureNode(firstProductMissing.node);
        return confirmIncompleteStep('产品/柜体数据还没有录入完整', incompleteMessages);
      }
      return true;
    }
    if (step === 'tasks') {
      const currentValues = form.getValues();
      const taskMissingNodes = mergeIncompleteNodes(collectIncompleteNodes(currentValues)).filter((item) => (
        item.node.type === 'task' || item.missing.includes('拆单任务')
      ));
      const invalidTask = watchedModules.some((module) => (
        module.items.some((item) => item.tasks.some((task) => (
          isBlank(task.task_name)
          || !hasPositiveNumber(task.quantity)
          || isBlank(task.unit)
        )))
      ));
      if (invalidTask) {
        const firstTaskMissing = taskMissingNodes[0];
        if (firstTaskMissing) selectStructureNode(firstTaskMissing.node);
        toast.error('拆单任务需要填写拆单任务名称、数量和单位');
        return false;
      }
      const incompleteMessages = taskIncompleteMessages(watchedModules);
      if (incompleteMessages.length > 0) {
        const firstTaskMissing = taskMissingNodes[0];
        if (firstTaskMissing) selectStructureNode(firstTaskMissing.node);
        return confirmIncompleteStep('拆单任务数据还没有录入完整', incompleteMessages);
      }
      return true;
    }
    return true;
  };

  const goToStep = async (targetStep: StepId) => {
    const targetIndex = STEPS.findIndex((step) => step.id === targetStep);
    if (targetIndex <= activeStepIndex) {
      activateStep(targetStep);
      return;
    }
    for (let index = activeStepIndex; index < targetIndex; index += 1) {
      const valid = await validateStep(STEPS[index].id);
      if (!valid) return;
    }
    activateStep(targetStep);
  };

  const goNext = async () => {
    const next = STEPS[Math.min(STEPS.length - 1, activeStepIndex + 1)];
    await goToStep(next.id);
  };

  const goPrev = () => {
    const prev = STEPS[Math.max(0, activeStepIndex - 1)];
    activateStep(prev.id);
  };

  const goToCompactStep = (step: CompactStepId) => {
    if (step === 'basic') {
      selectStructureNode({ type: 'order' });
      return;
    }
    if (step === 'structure') {
      const normalized = normalizeSelectedNode(selectedNode, watchedModules);
      if (normalized.type === 'order') selectStructureNode({ type: 'space', moduleIndex: 0 });
      else selectStructureNode(normalized);
      return;
    }
    void goToStep(step);
  };

  const onSubmit: SubmitHandler<OrderFormValues> = async (values) => {
    setSubmitting(true);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, existing_order_id: savedOrderId || undefined }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('订单创建成功');
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(data.error || '创建订单失败');
      }
    } catch {
      toast.error('创建订单失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-3 right-3 top-3 bottom-3 h-auto max-h-none w-auto max-w-none translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-xl p-0 shadow-2xl sm:max-w-none">
        <DialogHeader className="border-b bg-background px-8 py-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 pr-8 md:flex-row md:items-start md:justify-between">
              <div>
                <DialogTitle className="flex flex-wrap items-center gap-2 text-xl">
                  <span>{mode === 'factory_material' ? '创建材料订单' : '创建经销商订单'}</span>
                  {activeStep === 'spaces' ? (
                    <>
                      <span className="text-muted-foreground">-</span>
                      <span className="inline-flex items-center gap-1.5">
                        <Layers3 className="h-5 w-5" />
                        结构录入
                      </span>
                    </>
                  ) : null}
                </DialogTitle>
              </div>
              {recorderName ? (
                <span className="text-xl font-semibold leading-none md:text-right">
                  {recorderName}
                </span>
              ) : null}
            </div>
            <CompactOrderProgress
              activeStep={compactStep}
              onSelect={goToCompactStep}
            />
            {activeStep === 'spaces' ? (
              <StructureOrderHeader
                form={form}
                modules={watchedModules}
                onAddSpace={addSpace}
              />
            ) : null}
          </div>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={cn(
            'grid min-h-0 bg-muted/10',
            activeStep === 'spaces' ? 'grid-cols-1' : 'lg:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[420px_minmax(0,1fr)]'
          )}
        >
          {activeStep !== 'spaces' ? (
            <aside className="min-h-0 border-r bg-muted/30">
              <ScrollArea className="h-[calc(100vh-216px)]">
                <OrderStructureSidebar
                  values={watchedValues}
                  selectedNode={normalizedSelectedNode}
                  incompleteNodes={incompleteNodes}
                  totalAmount={totalAmount}
                  onSelectNode={selectStructureNode}
                  onAddSpace={addSpace}
                  onAddSpaceAfter={addSpaceAfter}
                  onRemoveSpace={removeSpace}
                  onAddProduct={addProduct}
                  onRemoveProduct={removeProduct}
                  onAddTask={(moduleIndex, itemIndex) => addTask(moduleIndex, itemIndex)}
                  onAddTaskAfter={addTaskAfter}
                  onRemoveTask={removeTask}
                />
              </ScrollArea>
            </aside>
          ) : null}

          <div className="flex min-h-0 flex-col bg-background">
            <ScrollArea
              className={cn(
                activeStep === 'spaces'
                  ? 'h-[calc(100vh-374px)]'
                  : 'h-[calc(100vh-288px)]'
              )}
            >
              <div className="w-full space-y-6 p-5 xl:p-8">
                {activeStep === 'attachments' ? (
                  <AttachmentsStep
                    form={form}
                    modules={watchedModules}
                  />
                ) : null}

                {activeStep === 'confirm' ? (
                  <ConfirmStep
                    values={form.getValues()}
                    totalAmount={totalAmount}
                  />
                ) : null}

                {activeStep === 'spaces' ? (
                  <StructureSpreadsheetStep
                    form={form}
                    modules={watchedModules}
                    onAddTask={addTaskInline}
                    onRemoveTask={removeTaskInline}
                    onRemoveSpace={removeSpace}
                    onSelectNode={selectStructureNode}
                  />
                ) : null}

                {activeStep !== 'spaces' && activeStep !== 'attachments' && activeStep !== 'confirm' ? (
                  <NodeEditorPanel
                    form={form}
                    mode={mode}
                    parentOrders={parentOrders}
                    generatingOrderNo={generatingOrderNo}
                    savingBasicOrder={savingBasicOrder}
                    selectedNode={normalizedSelectedNode}
                    modules={watchedModules}
                    onGenerateOrderNo={generateOrderNo}
                    onSaveBasicOrder={() => void saveBasicOrder()}
                    onAddSpace={addSpace}
                    onSelectNode={selectStructureNode}
                    onRemoveSpace={removeSpace}
                    onAddProduct={addProduct}
                    onCopyProduct={copyProduct}
                    onRemoveProduct={removeProduct}
                    onCopyTask={copyTask}
                    onRemoveTask={removeTask}
                  />
                ) : null}
              </div>
            </ScrollArea>

            <DialogFooter className="items-center justify-between gap-3 border-t bg-background px-8 py-5 sm:justify-between">
              <div className="min-w-0 flex-1 text-sm text-muted-foreground">
                {incompleteCount === 0 ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600"><CircleCheck className="h-4 w-4" />结构已完整</span>
                ) : null}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {activeStep !== 'basic' ? (
                  <>
                    <Button type="button" variant="outline" onClick={goPrev} disabled={activeStepIndex <= 0}>上一步</Button>
                    <Button type="button" variant="outline" onClick={() => void goNext()} disabled={activeStep === 'confirm'}>下一步</Button>
                  </>
                ) : null}
                {activeStep !== 'basic' ? (
                  <Button type="submit" disabled={submitting} className="min-w-[112px] gap-2">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {submitting ? '保存中...' : '完成录入'}
                  </Button>
                ) : null}
              </div>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BasicStep({
  form,
  mode,
  parentOrders,
  generatingOrderNo,
  savingBasicOrder,
  onGenerateOrderNo,
  onSaveBasicOrder,
}: {
  form: UseFormReturn<OrderFormValues, unknown, OrderFormValues>;
  mode: OrderMode;
  parentOrders: Order[];
  generatingOrderNo: boolean;
  savingBasicOrder: boolean;
  onGenerateOrderNo: () => void;
  onSaveBasicOrder: () => void;
}) {
  return (
    <section className="space-y-5">
      <StepTitle icon={<ClipboardList className="h-5 w-5" />} title="基础信息" description="先确定订单编号、订单名称和交付要求。" />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="订单编号 *" error={form.formState.errors.order_no?.message}>
          <div className="flex gap-2">
            <Input {...form.register('order_no')} className="font-mono" placeholder="订单编号" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onGenerateOrderNo}
              disabled={generatingOrderNo}
              aria-label="重新生成订单编号"
              title="重新生成订单编号"
            >
              {generatingOrderNo ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </Field>

        {mode === 'factory_material' ? (
          <Field label="关联经销商订单">
            <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" {...form.register('parent_order_id')}>
              <option value="">不关联</option>
              {parentOrders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.order_no} - {order.from_tenant?.company_name || order.from_tenant?.name || order.customer_name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field label="订单名称 *" error={form.formState.errors.customer_name?.message}>
          <Input {...form.register('customer_name')} placeholder="小区 / 楼栋 / 门牌号 / 客户简称" />
        </Field>

        <Field label="客户电话">
          <Input {...form.register('customer_phone')} placeholder="客户电话" />
        </Field>

        <Field label="发货地址">
          <Input {...form.register('customer_address')} placeholder="省 / 市 / 区 / 街道 / 门牌号" />
        </Field>
      </div>

      <Field label="订单备注">
        <Textarea {...form.register('remark')} placeholder="填写订单要求、交付说明或协作备注" className="min-h-32" />
      </Field>

      <Field label="交付日期">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input type="date" {...form.register('delivery_date')} className="w-[180px]" />
          <Button
            type="button"
            onClick={onSaveBasicOrder}
            disabled={savingBasicOrder}
            className="min-w-[128px] bg-emerald-600 px-6 text-white shadow-sm hover:bg-emerald-700"
          >
            {savingBasicOrder ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            保存订单
          </Button>
        </div>
      </Field>
    </section>
  );
}

function StructureOrderHeader({
  form,
  modules,
  onAddSpace,
}: {
  form: UseFormReturn<OrderFormValues, unknown, OrderFormValues>;
  modules: OrderModuleFormValues[];
  onAddSpace: () => void;
}) {
  const orderNo = form.watch('order_no');
  const orderName = form.watch('customer_name');
  const customerPhone = form.watch('customer_phone');
  const deliveryDate = form.watch('delivery_date');
  const constructionEntryCount = countConstructionEntries(modules);

  return (
    <div className="overflow-x-auto rounded-md border bg-background shadow-sm">
      <div className="grid min-w-[980px] grid-cols-[120px_170px_100px_minmax(120px,1fr)_90px_132px_90px_112px_250px] text-sm">
        <div className="flex items-center justify-center border-r bg-muted/30 px-2 py-2 font-medium text-foreground">订单编号</div>
        <div className="flex min-w-0 items-center justify-center border-r px-2 py-2 font-mono text-muted-foreground">
          <span className="block whitespace-nowrap" title={orderNo || undefined}>{orderNo || '-'}</span>
        </div>
        <div className="flex items-center justify-center border-r bg-muted/30 px-2 py-2 font-medium text-foreground">订单名称</div>
        <div className="flex min-w-0 items-center justify-center border-r px-2 py-2 text-muted-foreground">
          <span className="block truncate">{orderName || '-'}</span>
        </div>
        <div className="flex items-center justify-center border-r bg-muted/30 px-2 py-2 font-medium text-foreground">联系电话</div>
        <div className="flex min-w-0 items-center justify-center border-r px-2 py-2 text-muted-foreground">
          <span className="block whitespace-nowrap">{customerPhone || '-'}</span>
        </div>
        <div className="flex items-center justify-center border-r bg-muted/30 px-2 py-2 font-medium text-foreground">交付日期</div>
        <div className="flex items-center justify-center border-r px-2 py-2 text-muted-foreground">{deliveryDate || '-'}</div>
        <div className="min-w-0 px-2 py-1.5 text-sm font-medium text-foreground">
          <div className="flex h-full items-center justify-end gap-3">
            <span>生成总数：<span className="font-mono">{constructionEntryCount}</span></span>
            <Button type="button" variant="outline" size="sm" onClick={onAddSpace} className="h-8 whitespace-nowrap">
              <Plus className="mr-1 h-4 w-4" />新增空间
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StructureSpreadsheetStep({
  form,
  modules,
  onAddTask,
  onRemoveTask,
  onRemoveSpace,
  onSelectNode,
}: {
  form: UseFormReturn<OrderFormValues, unknown, OrderFormValues>;
  modules: OrderModuleFormValues[];
  onAddTask: (moduleIndex: number) => void;
  onRemoveTask: (moduleIndex: number, itemIndex: number, taskIndex: number) => void;
  onRemoveSpace: (moduleIndex: number) => void;
  onSelectNode: (node: SelectedNode) => void;
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const orderNo = form.watch('order_no');
  const [expandedModuleIndexes, setExpandedModuleIndexes] = useState<Set<number>>(() => new Set());
  const [activeModuleIndex, setActiveModuleIndex] = useState<number | null>(null);
  const activeModuleExpanded = activeModuleIndex !== null && expandedModuleIndexes.has(activeModuleIndex);
  const moduleGridClass = 'grid min-w-[980px] grid-cols-[170px_220px_minmax(320px,1fr)_280px]';

  useEffect(() => {
    const section = sectionRef.current;
    const viewport = section?.closest('[data-slot="scroll-area-viewport"]');
    if (!section || !(viewport instanceof HTMLElement)) return;

    const syncActiveModule = () => {
      const expandedIndexes = Array.from(expandedModuleIndexes).sort((a, b) => a - b);
      if (expandedIndexes.length === 0) {
        setActiveModuleIndex(null);
        return;
      }

      const viewportTop = viewport.getBoundingClientRect().top;
      const stickyHeader = section.querySelector<HTMLElement>('[data-current-module-header="true"]');
      const threshold = viewportTop + (stickyHeader?.offsetHeight || 0) + 8;
      let nextActive = expandedIndexes[0];

      for (const moduleIndex of expandedIndexes) {
        const row = section.querySelector<HTMLElement>(`[data-module-row="${moduleIndex}"]`);
        if (!row) continue;
        const rowTop = row.getBoundingClientRect().top;
        if (rowTop <= threshold) nextActive = moduleIndex;
      }

      setActiveModuleIndex((current) => (current === nextActive ? current : nextActive));
    };

    syncActiveModule();
    viewport.addEventListener('scroll', syncActiveModule, { passive: true });
    window.addEventListener('resize', syncActiveModule);
    return () => {
      viewport.removeEventListener('scroll', syncActiveModule);
      window.removeEventListener('resize', syncActiveModule);
    };
  }, [expandedModuleIndexes, modules.length]);

  const toggleModuleTasks = (moduleIndex: number) => {
    const willExpand = !expandedModuleIndexes.has(moduleIndex);
    setExpandedModuleIndexes((current) => {
      const next = new Set(current);
      if (next.has(moduleIndex)) next.delete(moduleIndex);
      else next.add(moduleIndex);
      return next;
    });
    if (willExpand) setActiveModuleIndex(moduleIndex);
    else setActiveModuleIndex((current) => (current === moduleIndex ? null : current));
  };

  const addTaskAndExpand = (moduleIndex: number) => {
    onAddTask(moduleIndex);
    setActiveModuleIndex(moduleIndex);
    setExpandedModuleIndexes((current) => {
      const next = new Set(current);
      next.add(moduleIndex);
      return next;
    });
  };

  const renderStickyModuleHeader = (module: OrderModuleFormValues, moduleIndex: number) => {
    const error = form.formState.errors.modules?.[moduleIndex]?.module_name?.message;
    const moduleOrderNo = orderNo ? `${orderNo}-${moduleIndex + 1}` : `-${moduleIndex + 1}`;
    return (
      <div data-current-module-header="true" className="sticky top-0 z-40 overflow-x-auto rounded-md border border-rose-200 bg-rose-50 shadow-lg">
        <div className={cn(moduleGridClass, 'border-b text-sm')}>
          <div className="border-r bg-rose-50 p-0 align-middle">
            <button
              type="button"
              onClick={() => toggleModuleTasks(moduleIndex)}
              className="flex h-full min-h-12 w-full items-center gap-1 px-2 py-2 text-left font-mono text-xs font-medium text-foreground hover:bg-rose-100/70"
              aria-expanded
              title={`${moduleOrderNo}，收起三级订单`}
            >
              <ChevronRight className="h-3.5 w-3.5 shrink-0 rotate-90" />
              <span className="min-w-0 truncate">{moduleOrderNo}</span>
            </button>
          </div>
          <div className="border-r bg-emerald-50/80 p-1.5">
            <DatalistInput
              listId={`sticky-module-${moduleIndex}`}
              values={ORDER_MODULE_PRESETS}
              {...form.register(`modules.${moduleIndex}.module_name`)}
              onFocus={() => {
                setActiveModuleIndex(moduleIndex);
                onSelectNode({ type: 'space', moduleIndex });
              }}
              placeholder="空间名称"
              className={error ? 'border-destructive' : undefined}
            />
            {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
          </div>
          <div className="border-r bg-emerald-50/80 p-1.5">
            <Input
              {...form.register(`modules.${moduleIndex}.remark`)}
              onFocus={() => {
                setActiveModuleIndex(moduleIndex);
                onSelectNode({ type: 'space', moduleIndex });
              }}
              placeholder="备注"
            />
          </div>
          <div className="bg-emerald-50/80 p-1.5">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addTaskAndExpand(moduleIndex)}
                className="h-8 whitespace-nowrap"
              >
                <Plus className="mr-1 h-4 w-4" />新增拆单任务
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={modules.length <= 1}
                onClick={() => onRemoveSpace(moduleIndex)}
                aria-label="删除空间"
                title="删除空间"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderModuleRow = (module: OrderModuleFormValues, moduleIndex: number, keyPrefix = 'space-row') => {
    const error = form.formState.errors.modules?.[moduleIndex]?.module_name?.message;
    const isExpanded = expandedModuleIndexes.has(moduleIndex);
    const isStickyRow = activeModuleExpanded && activeModuleIndex === moduleIndex;
    const moduleOrderNo = orderNo ? `${orderNo}-${moduleIndex + 1}` : `-${moduleIndex + 1}`;
    if (isStickyRow) {
      return (
        <div data-module-row={moduleIndex} key={`${keyPrefix}-${moduleIndex}`} aria-hidden="true" className="h-12 border-b bg-emerald-50/30" />
      );
    }

    return (
      <div data-module-row={moduleIndex} key={`${keyPrefix}-${moduleIndex}`} className={cn(moduleGridClass, 'border-b bg-emerald-50/80 last:border-b-0')}>
        <div className={cn('border-r p-0 transition-colors', isExpanded ? 'bg-rose-50' : 'bg-emerald-50')}>
          <button
            type="button"
            onClick={() => toggleModuleTasks(moduleIndex)}
            className="flex h-full min-h-12 w-full items-center gap-1 px-2 py-2 text-left font-mono text-xs font-medium text-foreground hover:bg-rose-100/70"
            aria-expanded={isExpanded}
            title={`${moduleOrderNo}，${isExpanded ? '收起三级订单' : '展开三级订单'}`}
          >
            <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-transform', isExpanded && 'rotate-90')} />
            <span className="min-w-0 truncate">{moduleOrderNo}</span>
          </button>
        </div>
        <div className="border-r bg-emerald-50/80 p-1.5">
          <DatalistInput
            listId={`spreadsheet-module-${keyPrefix}-${moduleIndex}`}
            values={ORDER_MODULE_PRESETS}
            {...form.register(`modules.${moduleIndex}.module_name`)}
            onFocus={() => {
              setActiveModuleIndex(moduleIndex);
              onSelectNode({ type: 'space', moduleIndex });
            }}
            placeholder="空间名称"
            className={error ? 'border-destructive' : undefined}
          />
          {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
        </div>
        <div className="border-r bg-emerald-50/80 p-1.5">
          <Input
            {...form.register(`modules.${moduleIndex}.remark`)}
            onFocus={() => {
              setActiveModuleIndex(moduleIndex);
              onSelectNode({ type: 'space', moduleIndex });
            }}
            placeholder="备注"
          />
        </div>
        <div className="bg-emerald-50/80 p-1.5">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => addTaskAndExpand(moduleIndex)}
              className="h-8 whitespace-nowrap"
            >
              <Plus className="mr-1 h-4 w-4" />新增拆单任务
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={modules.length <= 1}
              onClick={() => onRemoveSpace(moduleIndex)}
              aria-label="删除空间"
              title="删除空间"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderTaskRows = (module: OrderModuleFormValues, moduleIndex: number) => {
    const isExpanded = expandedModuleIndexes.has(moduleIndex);
    if (!isExpanded) return null;
    const moduleOrderNo = orderNo ? `${orderNo}-${moduleIndex + 1}` : `-${moduleIndex + 1}`;
    return (module.items[0]?.tasks || []).map((_, taskIndex) => {
      const taskOrderNoPrefix = `${moduleOrderNo}-`;
      const taskOrderNoSuffix = String(taskIndex + 1);
      return (
      <div key={`space-task-row-${moduleIndex}-${taskIndex}`} className="grid min-w-[980px] grid-cols-[170px_minmax(0,1fr)] border-b bg-muted/10">
        <div className="flex items-center border-r px-2 py-3 font-mono text-xs text-muted-foreground">
          <span className="whitespace-nowrap">
            {taskOrderNoPrefix}
            <span className="text-base font-semibold text-foreground">{taskOrderNoSuffix}</span>
          </span>
        </div>
        <div className="min-w-0 p-3">
          <TaskFields
            form={form}
            moduleIndex={moduleIndex}
            itemIndex={0}
            taskIndex={taskIndex}
            onRemove={() => onRemoveTask(moduleIndex, 0, taskIndex)}
          />
        </div>
      </div>
      );
    });
  };

  return (
    <section ref={sectionRef} className="space-y-4">
      {activeModuleExpanded && activeModuleIndex !== null && modules[activeModuleIndex]
        ? renderStickyModuleHeader(modules[activeModuleIndex], activeModuleIndex)
        : null}
      <div className="overflow-x-auto rounded-md border bg-background shadow-sm">
        <div className="min-w-[980px] text-sm">
          {modules.map((module, moduleIndex) => (
            <Fragment key={`space-body-${moduleIndex}`}>
              {renderModuleRow(module, moduleIndex)}
              {renderTaskRows(module, moduleIndex)}
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductFields({
  form,
  moduleIndex,
  itemIndex,
  selected,
  canRemove,
  onFocus,
  onRemove,
}: {
  form: UseFormReturn<OrderFormValues, unknown, OrderFormValues>;
  moduleIndex: number;
  itemIndex: number;
  selected: boolean;
  canRemove: boolean;
  onFocus: () => void;
  onRemove: () => void;
}) {
  const baseName = `modules.${moduleIndex}.items.${itemIndex}` as const;
  const errors = form.formState.errors.modules?.[moduleIndex]?.items?.[itemIndex];
  const item = form.watch(baseName);
  const subtotal = (Number(item?.quantity) || 0) * (Number(item?.unit_price) || 0);

  return (
    <div className={cn('space-y-5 rounded-lg border p-5 shadow-sm', selected ? 'border-primary bg-primary/5' : 'bg-background')} onFocus={onFocus}>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">产品 #{itemIndex + 1}</div>
          <div className="text-xs text-muted-foreground">小计 ¥{subtotal.toFixed(2)}</div>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove} disabled={!canRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-12">
        <Field className="md:col-span-3" label="产品名称 *" error={errors?.product_name?.message}>
          <DatalistInput
            listId={`product-name-${moduleIndex}-${itemIndex}`}
            values={PRODUCT_NAME_OPTIONS}
            {...form.register(`${baseName}.product_name`)}
            placeholder="衣柜 / 地柜 / 门板"
          />
        </Field>
        <Field className="md:col-span-3" label="产品类型">
          <DatalistInput
            listId={`product-type-${moduleIndex}-${itemIndex}`}
            values={PRODUCT_TYPE_INPUT_OPTIONS}
            {...form.register(`${baseName}.product_type`)}
            placeholder="衣柜 / 柜体 / 自定义"
          />
        </Field>
        <Field className="md:col-span-2" label="数量 *" error={errors?.quantity?.message}>
          <Input type="number" min={1} step="1" {...form.register(`${baseName}.quantity`)} />
        </Field>
        <Field className="md:col-span-2" label="单位">
          <DatalistInput
            listId={`product-unit-${moduleIndex}-${itemIndex}`}
            values={ORDER_UNITS}
            {...form.register(`${baseName}.unit`)}
            placeholder="件 / 套 / 平方米"
          />
        </Field>
        <Field className="md:col-span-2" label="单价（元）" error={errors?.unit_price?.message}>
          <Input type="number" min={0} step="0.01" {...form.register(`${baseName}.unit_price`)} />
        </Field>

        <Field className="md:col-span-12" label="产品说明">
          <Textarea {...form.register(`${baseName}.remark`)} placeholder="填写产品说明、客户要求、图纸备注或现场注意事项" />
        </Field>
      </div>

      <AttachmentControl form={form} moduleIndex={moduleIndex} itemIndex={itemIndex} />
    </div>
  );
}

function TaskFields({
  form,
  moduleIndex,
  itemIndex,
  taskIndex,
  onRemove,
}: {
  form: UseFormReturn<OrderFormValues, unknown, OrderFormValues>;
  moduleIndex: number;
  itemIndex: number;
  taskIndex: number;
  onRemove: () => void;
}) {
  const baseName = `modules.${moduleIndex}.items.${itemIndex}.tasks.${taskIndex}` as const;
  const errors = form.formState.errors.modules?.[moduleIndex]?.items?.[itemIndex]?.tasks?.[taskIndex];
  const lengthMm = form.watch(`${baseName}.length_mm`);
  const widthMm = form.watch(`${baseName}.width_mm`);
  const quantity = form.watch(`${baseName}.quantity`);
  const unitPrice = form.watch(`${baseName}.unit_price`);
  const taskName = form.watch(`${baseName}.task_name`);
  const hardware = form.watch(`${baseName}.hardware`);
  const taskType = form.watch(`${baseName}.task_type`) as (typeof PRODUCTION_TASK_TYPES)[number] | undefined;
  const taskTypeLabel = taskType ? TASK_TYPE_LABELS[taskType] : TASK_TYPE_LABELS.process;
  const isDoorTask = isCabinetDoorTask(taskName, taskType);
  const attachments = form.watch(`${baseName}.attachments`) || [];
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const areaName = `${baseName}.area` as const;
    const lengthValue = optionalNumberValue(lengthMm);
    const widthValue = optionalNumberValue(widthMm);
    const currentArea = optionalNumberValue(form.getValues(areaName));

    if (lengthValue === undefined || widthValue === undefined) {
      if (currentArea !== undefined) {
        form.setValue(areaName, undefined, { shouldDirty: true, shouldValidate: true });
      }
      return;
    }

    const nextArea = Number(((lengthValue * widthValue) / 1_000_000).toFixed(4));
    if (currentArea === undefined || Math.abs(currentArea - nextArea) > 0.0001) {
      form.setValue(areaName, nextArea, { shouldDirty: true, shouldValidate: true });
    }
  }, [baseName, form, lengthMm, widthMm]);

  useEffect(() => {
    const inferredType = inferTaskTypeFromTaskName(taskName);
    if (inferredType && taskType !== inferredType) {
      form.setValue(`${baseName}.task_type`, inferredType, { shouldDirty: true, shouldValidate: true });
    }
  }, [baseName, form, taskName, taskType]);

  useEffect(() => {
    const subtotalName = `${baseName}.subtotal` as const;
    const quantityValue = optionalNumberValue(quantity);
    const unitPriceValue = optionalNumberValue(unitPrice);
    const currentSubtotal = optionalNumberValue(form.getValues(subtotalName));

    if (quantityValue === undefined || unitPriceValue === undefined) {
      if (currentSubtotal !== undefined) {
        form.setValue(subtotalName, undefined, { shouldDirty: true, shouldValidate: true });
      }
      return;
    }

    const nextSubtotal = Number((quantityValue * unitPriceValue).toFixed(2));
    if (currentSubtotal === undefined || Math.abs(currentSubtotal - nextSubtotal) > 0.001) {
      form.setValue(subtotalName, nextSubtotal, { shouldDirty: true, shouldValidate: true });
    }
  }, [baseName, form, quantity, unitPrice]);

  useEffect(() => {
    if (!isCabinetDoorTask(taskName, taskType) || !shouldAutoFillHingeHardware(hardware)) return;

    const doorHeight = optionalNumberValue(lengthMm);
    if (doorHeight === undefined || doorHeight <= 0) return;

    const hingeCount = hingeCountForDoorHeight(doorHeight);
    if (hingeCount === undefined) return;

    if (String(hardware ?? '').trim() !== '铰链') {
      form.setValue(`${baseName}.hardware`, '铰链', { shouldDirty: true, shouldValidate: true });
    }

    const hardwareQuantityName = `${baseName}.hardware_quantity` as const;
    const currentQuantity = optionalNumberValue(form.getValues(hardwareQuantityName));
    if (currentQuantity !== hingeCount) {
      form.setValue(hardwareQuantityName, hingeCount, { shouldDirty: true, shouldValidate: true });
    }
  }, [baseName, form, hardware, lengthMm, taskName, taskType]);

  const uploadTaskFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const currentAttachments = form.getValues(`${baseName}.attachments`) || [];
      const uploaded: OrderAttachmentFormValues[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('/api/orders/attachments', { method: 'POST', body: formData });
        const data = await response.json();
        if (data.success) uploaded.push(data.attachment);
        else toast.error(data.error || `${file.name} 上传失败`);
      }
      if (uploaded.length > 0) {
        form.setValue(`${baseName}.attachments`, [...currentAttachments, ...uploaded], { shouldDirty: true });
      }
    } finally {
      setUploading(false);
    }
  };

  const uploadClipboardImages = async (event: ClipboardEvent<HTMLDivElement>) => {
    const imageFiles = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    event.preventDefault();
    await uploadTaskFiles(imageFiles);
  };

  const captureScreenshot = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      toast.error('当前浏览器不支持直接截图，请先截图后 Ctrl+V 粘贴上传');
      return;
    }

    setUploading(true);
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (!context || canvas.width === 0 || canvas.height === 0) {
        toast.error('截图失败，请重试或使用粘贴截图');
        return;
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) {
        toast.error('截图生成失败，请重试或使用粘贴截图');
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const file = new File([blob], `截图-${timestamp}.png`, { type: 'image/png' });
      await uploadTaskFiles([file]);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') return;
      toast.error('截图失败，请重试或使用粘贴截图');
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      setUploading(false);
    }
  };

  return (
    <div className="w-full max-w-full overflow-hidden rounded-md border bg-background p-2 shadow-sm" onPaste={uploadClipboardImages}>
      <div className="grid w-full grid-cols-[136px_58px_58px_58px_42px_64px_58px_66px_46px_68px_52px_86px_52px_58px_64px_42px_26px_minmax(0,1fr)_30px_36px_28px] items-end gap-1">
        <Field
          label={(
            <span className="flex items-center justify-between gap-2">
              <span>任务名称 *</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">{taskTypeLabel}</span>
            </span>
          )}
          error={errors?.task_name?.message}
        >
          <input type="hidden" {...form.register(`${baseName}.task_type`)} />
          <DatalistInput
            listId={`task-name-${moduleIndex}-${itemIndex}-${taskIndex}`}
            values={TASK_NAME_OPTIONS}
            {...form.register(`${baseName}.task_name`)}
            placeholder="侧板 A / 封边拆单任务"
            compact
            className="h-8 px-2 text-xs"
          />
        </Field>
        <Field label="长度 mm">
          <Input className={cn(SPINNERLESS_NUMBER_INPUT_CLASS, 'h-8 px-2 text-xs')} type="number" min={0} step="0.1" {...form.register(`${baseName}.length_mm`)} />
        </Field>
        <Field label="宽度 mm">
          <Input className={cn(SPINNERLESS_NUMBER_INPUT_CLASS, 'h-8 px-2 text-xs')} type="number" min={0} step="0.1" {...form.register(`${baseName}.width_mm`)} />
        </Field>
        <Field label="厚度 mm">
          <Input className={cn(SPINNERLESS_NUMBER_INPUT_CLASS, 'h-8 px-2 text-xs')} type="number" min={0} step="0.1" {...form.register(`${baseName}.thickness_mm`)} />
        </Field>
        <Field label="数量 *" error={errors?.quantity?.message}>
          <Input className={cn(SPINNERLESS_NUMBER_INPUT_CLASS, 'h-8 px-2 text-xs')} type="number" min={0.01} step="0.01" {...form.register(`${baseName}.quantity`)} />
        </Field>
        <Field label="面积">
          <Input
            type="number"
            min={0}
            step="0.0001"
            className={cn(SPINNERLESS_NUMBER_INPUT_CLASS, 'h-8 px-2 text-xs')}
            {...form.register(`${baseName}.area`)}
          />
        </Field>
        <Field label="单位">
          <DatalistInput
            listId={`task-unit-${moduleIndex}-${itemIndex}-${taskIndex}`}
            values={ORDER_UNITS}
            {...form.register(`${baseName}.unit`)}
            placeholder="块 / 项 / 套"
            compact
            className="h-8 px-2 text-xs"
          />
        </Field>
        <Field label="材质">
          <DatalistInput
            listId={`task-material-${moduleIndex}-${itemIndex}-${taskIndex}`}
            values={MATERIAL_OPTIONS}
            {...form.register(`${baseName}.material`)}
            placeholder="多层板"
            compact
            className="h-8 px-2 text-xs"
          />
        </Field>
        <Field label="免拉手">
          {isDoorTask ? (
            <DatalistInput
              listId={`task-handleless-${moduleIndex}-${itemIndex}-${taskIndex}`}
              values={HANDLELESS_OPTIONS}
              {...form.register(`${baseName}.handleless`)}
              placeholder="无"
              compact
              className="h-8 px-2 text-xs"
            />
          ) : (
            <Input className="h-8 bg-muted px-2 text-xs" value="-" readOnly tabIndex={-1} />
          )}
        </Field>
        <Field label="工艺">
          <DatalistInput
            listId={`task-craft-${moduleIndex}-${itemIndex}-${taskIndex}`}
            values={TASK_CRAFT_OPTIONS}
            {...form.register(`${baseName}.craft`)}
            placeholder="混油"
            compact
            className="h-8 px-2 text-xs"
          />
        </Field>
        <Field label="颜色">
          <DatalistInput
            listId={`task-color-${moduleIndex}-${itemIndex}-${taskIndex}`}
            values={COLOR_OPTIONS}
            {...form.register(`${baseName}.color`)}
            placeholder="暖白"
            compact
            className="h-8 px-2 text-xs"
          />
        </Field>
        <Field label="施工面">
          <DatalistInput listId={`task-surface-${moduleIndex}-${itemIndex}-${taskIndex}`} values={CONSTRUCTION_SURFACE_OPTIONS} {...form.register(`${baseName}.construction_surface`)} placeholder="一面四边" compact className="h-8 px-2 text-xs" />
        </Field>
        <Field label="单价">
          <Input className={cn(SPINNERLESS_NUMBER_INPUT_CLASS, 'h-8 px-2 text-xs')} type="number" min={0} step="0.01" {...form.register(`${baseName}.unit_price`)} />
        </Field>
        <Field label="小计">
          <Input className={cn(SPINNERLESS_NUMBER_INPUT_CLASS, 'h-8 px-2 text-xs')} type="number" min={0} step="0.01" {...form.register(`${baseName}.subtotal`)} />
        </Field>
        <Field label="五金">
          <DatalistInput
            listId={`task-hardware-${moduleIndex}-${itemIndex}-${taskIndex}`}
            values={HARDWARE_OPTIONS}
            {...form.register(`${baseName}.hardware`)}
            placeholder="铰链 / 拉手"
            compact
            className="h-8 px-2 text-xs"
          />
        </Field>
        <Field label="五金数">
          <Input className={cn(SPINNERLESS_NUMBER_INPUT_CLASS, 'h-8 px-2 text-xs')} type="number" min={0} step="1" {...form.register(`${baseName}.hardware_quantity`)} />
        </Field>
        <Field label="备注">
          <Input className="h-8 px-2 text-xs" {...form.register(`${baseName}.remark`)} placeholder="补充要求" />
        </Field>
        <div aria-hidden="true" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="mb-0 h-8 w-8 bg-background"
          disabled={uploading}
          onClick={() => void captureScreenshot()}
          title="选择屏幕或窗口截图上传"
        >
          <Camera className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="outline" size="icon" className="mb-0 h-8 w-10 bg-background text-xs" disabled={uploading} asChild>
          <label className="cursor-pointer" title="上传图片、PDF，或复制截图后在本行粘贴">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : attachments.length > 0 ? attachments.length : <Upload className="h-3.5 w-3.5" />}
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(event) => {
                void uploadTaskFiles(Array.from(event.target.files || []));
                event.currentTarget.value = '';
              }}
            />
          </label>
        </Button>
        <Button type="button" variant="ghost" size="icon" className="mb-0 h-8 w-8 bg-background" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

function AttachmentsStep({
  modules,
}: {
  form: UseFormReturn<OrderFormValues, unknown, OrderFormValues>;
  modules: OrderModuleFormValues[];
}) {
  return (
    <section className="space-y-5">
      <StepTitle icon={<Paperclip className="h-5 w-5" />} title="附件检查" description="图纸、附件和产品说明已合并到产品基础信息中，这里只做汇总核对。" />
      <div className="space-y-4">
        {modules.map((module, moduleIndex) => (
          <div key={`${module.module_name}-${moduleIndex}`} className="rounded-lg border bg-background p-5 shadow-sm">
            <div className="mb-3 font-medium">{module.module_name || `空间 #${moduleIndex + 1}`}</div>
            <div className="space-y-3">
              {module.items.map((item, itemIndex) => (
                <div key={`${item.product_name}-${itemIndex}`} className="rounded-lg bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{item.product_name || `产品 #${itemIndex + 1}`}</div>
                      <div className="text-xs text-muted-foreground">{item.remark || '暂无产品说明'}</div>
                    </div>
                    <Badge variant="secondary">{item.attachments.length} 个附件</Badge>
                  </div>
                  {item.attachments.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.attachments.map((attachment, attachmentIndex) => (
                        <Badge key={`${attachment.file_path}-${attachmentIndex}`} variant="outline" className="gap-1">
                          <Paperclip className="h-3.5 w-3.5" />
                          {attachment.file_name}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AttachmentControl({
  form,
  moduleIndex,
  itemIndex,
}: {
  form: UseFormReturn<OrderFormValues, unknown, OrderFormValues>;
  moduleIndex: number;
  itemIndex: number;
}) {
  const [uploading, setUploading] = useState(false);
  const baseName = `modules.${moduleIndex}.items.${itemIndex}` as const;
  const item = form.watch(baseName);
  const attachments = item?.attachments || [];

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: OrderAttachmentFormValues[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('/api/orders/attachments', { method: 'POST', body: formData });
        const data = await response.json();
        if (data.success) uploaded.push(data.attachment);
        else toast.error(data.error || `${file.name} 上传失败`);
      }
      if (uploaded.length > 0) {
        form.setValue(`${baseName}.attachments`, [...attachments, ...uploaded], { shouldDirty: true });
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-lg bg-muted/30 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{item?.product_name || `产品 #${itemIndex + 1}`}</div>
          <div className="text-xs text-muted-foreground">{attachments.length} 个附件</div>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
          <label className="cursor-pointer">
            {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
            上传文件
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(event) => {
                uploadFiles(event.target.files);
                event.currentTarget.value = '';
              }}
            />
          </label>
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {attachments.map((attachment, index) => (
          <Button
            key={`${attachment.file_path}-${index}`}
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              form.setValue(
                `${baseName}.attachments`,
                attachments.filter((_, attachmentIndex) => attachmentIndex !== index),
                { shouldDirty: true }
              );
            }}
          >
            <Paperclip className="mr-1 h-3.5 w-3.5" />
            {attachment.file_name}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ConfirmStep({ values, totalAmount }: { values: OrderFormValues; totalAmount: number }) {
  const modules = values.modules || [];
  return (
    <section className="space-y-5">
      <StepTitle icon={<Check className="h-5 w-5" />} title="确认提交" description="经销商录入的拆单任务会作为生产草稿提交给工厂确认。" />
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="空间" value={`${modules.length}`} />
        <SummaryCard label="产品" value={`${countProducts(modules)}`} />
        <SummaryCard label="拆单任务" value={`${countTasks(modules)}`} />
        <SummaryCard label="订单金额" value={`¥${totalAmount.toFixed(2)}`} />
      </div>
      <div className="rounded-md border">
        <div className="border-b bg-muted/40 px-4 py-3 font-medium">订单结构</div>
        <div className="space-y-3 p-4">
          {modules.map((module, moduleIndex) => (
            <div key={`${module.module_name}-${moduleIndex}`}>
              <div className="font-medium">{moduleIndex + 1}. {module.module_name || '未命名空间'}</div>
              <div className="mt-2 space-y-2 pl-4">
                {module.items.map((item, itemIndex) => (
                  <div key={`${item.product_name}-${itemIndex}`} className="rounded-md bg-muted/30 p-3 text-sm">
                    <div className="font-medium">{item.product_name || '未命名产品'} · {item.quantity} {item.unit}</div>
                    <div className="mt-1 text-muted-foreground">
                      {item.tasks.length} 个拆单任务 · {item.attachments.length} 个附件
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CompactOrderProgress({
  activeStep,
  onSelect,
}: {
  activeStep: CompactStepId;
  onSelect: (step: CompactStepId) => void;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-4">
      {COMPACT_STEPS.map((step, index) => (
        <button
          key={step.id}
          type="button"
          onClick={() => onSelect(step.id)}
          className={cn(
            'rounded-md border px-3 py-2 text-left transition-colors',
            activeStep === step.id ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-background hover:bg-muted'
          )}
        >
          <div className="flex min-w-0 items-baseline gap-1.5 text-sm">
            <span className="shrink-0 font-medium">{index + 1}. {step.label}</span>
            <span className="shrink-0 text-muted-foreground">·</span>
            <span className="min-w-0 truncate text-xs text-muted-foreground">{step.description}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function NodeCompletenessBadge({ missing }: { missing: string[] }) {
  if (missing.length > 0) {
    return (
      <Badge variant="outline" className="gap-1 border-red-200 bg-red-50 text-red-700">
        <CircleAlert className="h-3 w-3" />
        缺 {missing.length}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
      <CircleCheck className="h-3 w-3" />
      完整
    </Badge>
  );
}

function OrderStructureSidebar({
  values,
  selectedNode,
  incompleteNodes,
  totalAmount,
  onSelectNode,
  onAddSpace,
  onAddSpaceAfter,
  onRemoveSpace,
  onAddProduct,
  onRemoveProduct,
  onAddTask,
  onAddTaskAfter,
  onRemoveTask,
}: {
  values: OrderFormValues;
  selectedNode: SelectedNode;
  incompleteNodes: IncompleteNode[];
  totalAmount: number;
  onSelectNode: (node: SelectedNode) => void;
  onAddSpace: () => void;
  onAddSpaceAfter: (moduleIndex: number) => void;
  onRemoveSpace: (moduleIndex: number) => void;
  onAddProduct: (moduleIndex: number) => void;
  onRemoveProduct: (moduleIndex: number, itemIndex: number) => void;
  onAddTask: (moduleIndex: number, itemIndex: number) => void;
  onAddTaskAfter: (moduleIndex: number, itemIndex: number, taskIndex: number) => void;
  onRemoveTask: (moduleIndex: number, itemIndex: number, taskIndex: number) => void;
}) {
  const missingByKey = new Map<string, string[]>();
  incompleteNodes.forEach((item) => {
    const key = selectedNodeKey(item.node);
    missingByKey.set(key, Array.from(new Set([...(missingByKey.get(key) || []), ...item.missing])));
  });
  const selectedKey = selectedNodeKey(selectedNode);
  const orderMissing = missingByKey.get('order') || [];
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());

  const branchKeys = values.modules.flatMap((module, moduleIndex) => [
    `space:${moduleIndex}`,
    ...module.items.map((_, itemIndex) => `product:${moduleIndex}:${itemIndex}`),
  ]);
  const isCollapsed = (key: string) => collapsedKeys.has(key);
  const expandBranch = useCallback((key: string) => {
    setCollapsedKeys((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }, []);
  const toggleBranch = useCallback((key: string) => {
    setCollapsedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  const expandAll = () => setCollapsedKeys(new Set());
  const collapseAll = () => setCollapsedKeys(new Set(branchKeys));

  useEffect(() => {
    setCollapsedKeys((current) => {
      const next = new Set(current);
      if (selectedNode.type === 'product' || selectedNode.type === 'task') {
        next.delete(`space:${selectedNode.moduleIndex}`);
      }
      if (selectedNode.type === 'task') {
        next.delete(`product:${selectedNode.moduleIndex}:${selectedNode.itemIndex}`);
      }
      return next.size === current.size ? current : next;
    });
  }, [selectedNode]);

  return (
    <div className="space-y-5 p-4">
      <div className="space-y-3 rounded-lg border bg-background p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-medium">
            <ClipboardList className="h-4 w-4" />
            四级订单结构
          </div>
          <NodeCompletenessBadge missing={incompleteNodes.flatMap((node) => node.missing)} />
        </div>
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <MiniStat label="空间" value={values.modules.length} />
          <MiniStat label="产品" value={countProducts(values.modules)} />
          <MiniStat label="拆单任务" value={countTasks(values.modules)} />
          <MiniStat label="附件" value={countAttachments(values.modules)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onAddSpace}>
            <Plus className="mr-1 h-3.5 w-3.5" />空间
          </Button>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={expandAll}>
            全部展开
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={collapseAll}>
            全部折叠
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="flex items-center gap-1 rounded-md">
          <div className="flex h-8 w-8 items-center justify-center text-muted-foreground">
            <ClipboardList className="h-4 w-4" />
          </div>
          <button
            type="button"
            onClick={() => onSelectNode({ type: 'order' })}
            className={cn(
              'flex min-w-0 flex-1 items-center justify-between rounded-md px-2 py-2 text-left text-sm transition-colors',
              selectedKey === 'order' ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-muted'
            )}
          >
            <span className="min-w-0 truncate font-medium">{values.order_no || '订单基础信息'}</span>
            <NodeCompletenessBadge missing={orderMissing} />
          </button>
        </div>

        {values.modules.map((module, moduleIndex) => {
          const spaceNode: SelectedNode = { type: 'space', moduleIndex };
          const spaceKey = selectedNodeKey(spaceNode);
          const spaceMissing = missingByKey.get(spaceKey) || [];
          const spaceCollapsed = isCollapsed(spaceKey);
          return (
            <div key={`${module.module_name}-${moduleIndex}`} className="space-y-1 border-l border-muted pl-2">
              <div className="flex items-center gap-1 rounded-md">
                <button
                  type="button"
                  aria-label={spaceCollapsed ? '展开空间' : '折叠空间'}
                  title={spaceCollapsed ? '展开空间' : '折叠空间'}
                  onClick={() => toggleBranch(spaceKey)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <ChevronRight className={cn('h-4 w-4 transition-transform', !spaceCollapsed && 'rotate-90')} />
                </button>
                <button
                  type="button"
                  onClick={() => onSelectNode(spaceNode)}
                  className={cn(
                    'flex min-w-0 flex-1 items-center justify-between rounded-md px-2 py-2 text-left text-sm transition-colors',
                    selectedKey === spaceKey ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-muted'
                  )}
                >
                  <span className="min-w-0 truncate">{module.module_name || `空间 #${moduleIndex + 1}`}</span>
                  <span className="flex items-center gap-1">
                    <Badge variant="secondary">{module.items.length} 产品</Badge>
                    <NodeCompletenessBadge missing={spaceMissing} />
                  </span>
                </button>
                <TreeIconButton label="新增同级空间" onClick={() => onAddSpaceAfter(moduleIndex)} icon={<span className="text-sm leading-none">+</span>} />
                <TreeIconButton label="删除空间" onClick={() => onRemoveSpace(moduleIndex)} icon={<Trash2 className="h-3.5 w-3.5" />} disabled={values.modules.length <= 1} destructive />
              </div>

              {!spaceCollapsed ? <div className="space-y-1 border-l border-muted/80 pl-5">
                {module.items.map((item, itemIndex) => {
                  const productNode: SelectedNode = { type: 'product', moduleIndex, itemIndex };
                  const productKey = selectedNodeKey(productNode);
                  const productMissing = missingByKey.get(productKey) || [];
                  const productCollapsed = isCollapsed(productKey);
                  return (
                    <div key={`${item.product_name}-${itemIndex}`} className="space-y-1">
                      <div className="flex items-center gap-1 rounded-md">
                        <button
                          type="button"
                          aria-label={productCollapsed ? '展开产品' : '折叠产品'}
                          title={productCollapsed ? '展开产品' : '折叠产品'}
                          onClick={() => toggleBranch(productKey)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', !productCollapsed && 'rotate-90')} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectNode(productNode)}
                          className={cn(
                            'flex min-w-0 flex-1 items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                            selectedKey === productKey ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-muted'
                          )}
                        >
                          <span className="min-w-0 truncate">{item.product_name || `产品 #${itemIndex + 1}`}</span>
                          <span className="flex items-center gap-1">
                            <span className="text-muted-foreground">{item.tasks.length} 拆单任务</span>
                            <NodeCompletenessBadge missing={productMissing} />
                          </span>
                        </button>
                        <TreeIconButton label="+" onClick={() => {
                          expandBranch(spaceKey);
                          onAddProduct(moduleIndex);
                        }} icon={<span className="text-sm leading-none">+</span>} />
                        <TreeIconButton label="删除产品" onClick={() => onRemoveProduct(moduleIndex, itemIndex)} icon={<Trash2 className="h-3.5 w-3.5" />} disabled={module.items.length <= 1} destructive />
                      </div>

                      {!productCollapsed ? <div className="space-y-1 border-l border-muted/80 pl-7">
                        {item.tasks.map((task, taskIndex) => {
                          const taskNode: SelectedNode = { type: 'task', moduleIndex, itemIndex, taskIndex };
                          const taskKey = selectedNodeKey(taskNode);
                          const taskMissing = missingByKey.get(taskKey) || [];
                          return (
                            <div key={`${task.task_name}-${taskIndex}`} className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onSelectNode(taskNode)}
                                className={cn(
                                  'flex min-w-0 flex-1 items-center justify-between rounded px-2 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                                  selectedKey === taskKey ? 'bg-primary/10 font-medium text-primary' : ''
                                )}
                              >
                                <span className="min-w-0 truncate">{task.task_name || `拆单任务 #${taskIndex + 1}`}</span>
                                <NodeCompletenessBadge missing={taskMissing} />
                              </button>
                              <TreeIconButton label="新增同级拆单任务" onClick={() => onAddTaskAfter(moduleIndex, itemIndex, taskIndex)} icon={<span className="text-sm leading-none">+</span>} />
                              <TreeIconButton label="删除拆单任务" onClick={() => onRemoveTask(moduleIndex, itemIndex, taskIndex)} icon={<Trash2 className="h-3.5 w-3.5" />} destructive />
                            </div>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => onAddTask(moduleIndex, itemIndex)}
                          className="flex w-full items-center gap-2 rounded-md border border-dashed px-2 py-2 text-left text-xs text-muted-foreground transition hover:border-primary hover:bg-primary/5 hover:text-primary"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          新增拆单任务
                        </button>
                      </div> : null}
                    </div>
                  );
                })}
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      expandBranch(spaceKey);
                      onAddProduct(moduleIndex);
                    }}
                    className="flex w-full items-center gap-2 rounded-md border border-dashed px-2 py-2 text-left text-xs text-muted-foreground transition hover:border-primary hover:bg-primary/5 hover:text-primary"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    新增产品
                  </button>
                </div>
              </div> : null}
            </div>
          );
        })}
        <div className="pl-2">
          <button
            type="button"
            onClick={onAddSpace}
            className="flex w-full items-center gap-2 rounded-md border border-dashed px-2 py-2 text-left text-xs text-muted-foreground transition hover:border-primary hover:bg-primary/5 hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" />
            新增空间
          </button>
        </div>
      </div>

      <SummaryBox
        customerName={values.customer_name}
        modules={values.modules}
        totalAmount={totalAmount}
      />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/50 p-2">
      <div className="font-semibold">{value}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}

function TreeIconButton({
  label,
  icon,
  onClick,
  disabled,
  destructive,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('h-7 w-7 shrink-0', destructive ? 'text-destructive hover:text-destructive' : '')}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </Button>
  );
}

function NodeEditorPanel({
  form,
  mode,
  parentOrders,
  generatingOrderNo,
  savingBasicOrder,
  selectedNode,
  modules,
  onGenerateOrderNo,
  onSaveBasicOrder,
  onAddSpace,
  onSelectNode,
  onRemoveSpace,
  onAddProduct,
  onCopyProduct,
  onRemoveProduct,
  onCopyTask,
  onRemoveTask,
}: {
  form: UseFormReturn<OrderFormValues, unknown, OrderFormValues>;
  mode: OrderMode;
  parentOrders: Order[];
  generatingOrderNo: boolean;
  savingBasicOrder: boolean;
  selectedNode: SelectedNode;
  modules: OrderModuleFormValues[];
  onGenerateOrderNo: () => void;
  onSaveBasicOrder: () => void;
  onAddSpace: () => void;
  onSelectNode: (node: SelectedNode) => void;
  onRemoveSpace: (moduleIndex: number) => void;
  onAddProduct: (moduleIndex: number) => void;
  onCopyProduct: (moduleIndex: number, itemIndex: number) => void;
  onRemoveProduct: (moduleIndex: number, itemIndex: number) => void;
  onCopyTask: (moduleIndex: number, itemIndex: number, taskIndex: number) => void;
  onRemoveTask: (moduleIndex: number, itemIndex: number, taskIndex: number) => void;
}) {
  if (selectedNode.type === 'order') {
    return (
      <BasicStep
        form={form}
        mode={mode}
        parentOrders={parentOrders}
        generatingOrderNo={generatingOrderNo}
        savingBasicOrder={savingBasicOrder}
        onGenerateOrderNo={onGenerateOrderNo}
        onSaveBasicOrder={onSaveBasicOrder}
      />
    );
  }

  if (selectedNode.type === 'space') {
    return (
      <SpaceNodePanel
        form={form}
        moduleIndex={selectedNode.moduleIndex}
        moduleCount={modules.length}
        onAddProduct={() => onAddProduct(selectedNode.moduleIndex)}
        onAddSpace={onAddSpace}
        onRemove={() => onRemoveSpace(selectedNode.moduleIndex)}
      />
    );
  }

  if (selectedNode.type === 'product') {
    const items = modules[selectedNode.moduleIndex]?.items || [];
    return (
      <ProductNodePanel
        form={form}
        moduleIndex={selectedNode.moduleIndex}
        itemIndex={selectedNode.itemIndex}
        canRemove={items.length > 1}
        onCopy={() => onCopyProduct(selectedNode.moduleIndex, selectedNode.itemIndex)}
        onRemove={() => onRemoveProduct(selectedNode.moduleIndex, selectedNode.itemIndex)}
        onSelectNode={onSelectNode}
      />
    );
  }

  return (
    <TaskNodePanel
      form={form}
      moduleIndex={selectedNode.moduleIndex}
      itemIndex={selectedNode.itemIndex}
      taskIndex={selectedNode.taskIndex}
      onCopy={() => onCopyTask(selectedNode.moduleIndex, selectedNode.itemIndex, selectedNode.taskIndex)}
      onRemove={() => onRemoveTask(selectedNode.moduleIndex, selectedNode.itemIndex, selectedNode.taskIndex)}
      onSelectProduct={() => onSelectNode({ type: 'product', moduleIndex: selectedNode.moduleIndex, itemIndex: selectedNode.itemIndex })}
    />
  );
}

function SpaceNodePanel({
  form,
  moduleIndex,
  moduleCount,
  onAddProduct,
  onAddSpace,
  onRemove,
}: {
  form: UseFormReturn<OrderFormValues, unknown, OrderFormValues>;
  moduleIndex: number;
  moduleCount: number;
  onAddProduct: () => void;
  onAddSpace: () => void;
  onRemove: () => void;
}) {
  const error = form.formState.errors.modules?.[moduleIndex]?.module_name?.message;
  const orderModule = form.watch(`modules.${moduleIndex}`);
  return (
    <section className="space-y-5">
      <StepTitle icon={<Layers3 className="h-5 w-5" />} title={orderModule?.module_name || `空间 #${moduleIndex + 1}`} description="二级单元。一个订单可以包含多个空间，每个空间下面录入多个产品。" />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onAddProduct}>
          <Plus className="mr-1 h-4 w-4" />新增产品
        </Button>
        <Button type="button" variant="outline" onClick={onAddSpace}>
          <Plus className="mr-1 h-4 w-4" />新增空间
        </Button>
        <Button type="button" variant="ghost" onClick={onRemove} disabled={moduleCount <= 1}>
          <Trash2 className="mr-1 h-4 w-4 text-destructive" />删除空间
        </Button>
      </div>
      <div className="rounded-lg border bg-background p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="空间名称 *" error={error}>
            <DatalistInput
              listId={`module-presets-node-${moduleIndex}`}
              values={ORDER_MODULE_PRESETS}
              {...form.register(`modules.${moduleIndex}.module_name`)}
              placeholder="主卧 / 厨房 / 客厅 / 自定义"
            />
          </Field>
          <Field label="空间备注">
            <Input {...form.register(`modules.${moduleIndex}.remark`)} placeholder="可选" />
          </Field>
        </div>
      </div>
    </section>
  );
}

function ProductNodePanel({
  form,
  moduleIndex,
  itemIndex,
  canRemove,
  onCopy,
  onRemove,
  onSelectNode,
}: {
  form: UseFormReturn<OrderFormValues, unknown, OrderFormValues>;
  moduleIndex: number;
  itemIndex: number;
  canRemove: boolean;
  onCopy: () => void;
  onRemove: () => void;
  onSelectNode: (node: SelectedNode) => void;
}) {
  const productName = form.watch(`modules.${moduleIndex}.items.${itemIndex}.product_name`);
  const spaceName = form.watch(`modules.${moduleIndex}.module_name`);
  return (
    <section className="space-y-5">
      <StepTitle icon={<Package className="h-5 w-5" />} title={productName || `产品 #${itemIndex + 1}`} description={`三级对象，归属：${spaceName || `空间 #${moduleIndex + 1}`}`} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onCopy}>
          <Copy className="mr-1 h-4 w-4" />复制产品
        </Button>
        <Button type="button" variant="ghost" onClick={onRemove} disabled={!canRemove}>
          <Trash2 className="mr-1 h-4 w-4 text-destructive" />删除产品
        </Button>
      </div>
      <ProductFields
        form={form}
        moduleIndex={moduleIndex}
        itemIndex={itemIndex}
        selected
        canRemove={canRemove}
        onFocus={() => onSelectNode({ type: 'product', moduleIndex, itemIndex })}
        onRemove={onRemove}
      />
    </section>
  );
}

function TaskNodePanel({
  form,
  moduleIndex,
  itemIndex,
  taskIndex,
  onCopy,
  onRemove,
  onSelectProduct,
}: {
  form: UseFormReturn<OrderFormValues, unknown, OrderFormValues>;
  moduleIndex: number;
  itemIndex: number;
  taskIndex: number;
  onCopy: () => void;
  onRemove: () => void;
  onSelectProduct: () => void;
}) {
  const taskName = form.watch(`modules.${moduleIndex}.items.${itemIndex}.tasks.${taskIndex}.task_name`);
  const productName = form.watch(`modules.${moduleIndex}.items.${itemIndex}.product_name`);
  return (
    <section className="space-y-5">
      <StepTitle icon={<Workflow className="h-5 w-5" />} title={taskName || `拆单任务 #${taskIndex + 1}`} description={`拆单任务，解释并拆解产品：${productName || `产品 #${itemIndex + 1}`}`} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={onSelectProduct}>
          返回产品
        </Button>
        <Button type="button" variant="outline" onClick={onCopy}>
          <Copy className="mr-1 h-4 w-4" />复制拆单任务
        </Button>
        <Button type="button" variant="ghost" onClick={onRemove}>
          <Trash2 className="mr-1 h-4 w-4 text-destructive" />删除拆单任务
        </Button>
      </div>
      <TaskFields
        form={form}
        moduleIndex={moduleIndex}
        itemIndex={itemIndex}
        taskIndex={taskIndex}
        onRemove={onRemove}
      />
    </section>
  );
}

function SummaryBox({
  customerName,
  modules,
  totalAmount,
}: {
  customerName: string;
  modules: OrderModuleFormValues[];
  totalAmount: number;
}) {
  return (
    <div className="space-y-3 rounded-lg border bg-background p-4 text-sm shadow-sm">
      <div className="font-medium">当前摘要</div>
      <div className="grid grid-cols-2 gap-2 text-muted-foreground">
        <span>订单名称</span><span className="truncate text-right text-foreground">{customerName || '-'}</span>
        <span>空间</span><span className="text-right text-foreground">{modules.length}</span>
        <span>产品</span><span className="text-right text-foreground">{countProducts(modules)}</span>
        <span>拆单任务</span><span className="text-right text-foreground">{countTasks(modules)}</span>
        <span>附件</span><span className="text-right text-foreground">{countAttachments(modules)}</span>
        <span>金额</span><span className="text-right font-mono text-foreground">¥{totalAmount.toFixed(2)}</span>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-5 shadow-sm">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function StepTitle({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-lg bg-muted p-2.5">{icon}</div>
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function DatalistInput({
  listId,
  values,
  compact = false,
  ...props
}: ComponentProps<typeof Input> & { listId: string; values: readonly string[]; compact?: boolean }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const { ref: forwardedRef, onChange, onFocus, onClick, className, disabled, ...inputProps } = props as ComponentProps<'input'> & {
    ref?: Ref<HTMLInputElement>;
  };

  const setInputRef = (node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (typeof forwardedRef === 'function') {
      forwardedRef(node);
    }
  };

  const chooseValue = (value: string) => {
    const input = inputRef.current;
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    onChange?.({ target: input, currentTarget: input } as ChangeEvent<HTMLInputElement>);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={cn('flex', compact ? 'gap-1' : 'gap-2')}>
          <Input
            {...inputProps}
            ref={setInputRef}
            disabled={disabled}
            autoComplete="off"
            className={cn('min-w-0', className)}
            onFocus={(event) => {
              onFocus?.(event);
              if (!disabled) setOpen(true);
            }}
            onClick={(event) => {
              onClick?.(event);
              if (!disabled) setOpen(true);
            }}
          />
          {!compact ? (
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                disabled={disabled}
                title="展开选项"
                aria-label="展开选项"
              >
                <ChevronsUpDown className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          ) : null}
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[min(28rem,calc(100vw-2rem))] p-0"
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <Command>
          <CommandInput placeholder="搜索选项..." />
          <CommandList>
            <CommandEmpty>没有匹配选项</CommandEmpty>
            <CommandGroup>
              {values.map((value) => (
                <CommandItem key={`${listId}-${value}`} value={value} onSelect={() => chooseValue(value)}>
                  {value}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <Label className="text-[11px] leading-none">{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
