'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ComponentProps, ReactNode, Ref } from 'react';
import { useFieldArray, useForm, type Resolver, type SubmitHandler, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Check,
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
  Sparkles,
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { OrderMode } from '@/lib/order-flow';
import {
  CONSTRUCTION_SURFACE_OPTIONS,
  FORMING_CRAFT_OPTIONS,
  ORDER_MODULE_PRESETS,
  ORDER_UNITS,
  PAINTING_CRAFT_OPTIONS,
  PRODUCTION_TASK_TYPES,
  WOODWORKING_CRAFT_OPTIONS,
  orderFormSchema,
  type Order,
  type OrderAttachmentFormValues,
  type OrderFormValues,
  type OrderItemFormValues,
  type OrderModuleFormValues,
  type ProductionTaskDraftFormValues,
  type TenantOption,
} from '../schemas';

interface CreateOrderDialogProps {
  open: boolean;
  mode: OrderMode;
  partnerLabel: string;
  parentOrders: Order[];
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
  { id: 'basic', label: '基础信息', description: '订单编号、工厂企业和交付要求' },
  { id: 'spaces', label: '空间/房间', description: '主卧、厨房、客厅等二级结构' },
  { id: 'products', label: '产品/柜体', description: '衣柜、门板、柜体和基础规格' },
  { id: 'tasks', label: '拆单任务', description: '板件、五金、工序、安装、包装' },
  { id: 'attachments', label: '附件备注', description: '产品图片、图纸和补充文件' },
  { id: 'confirm', label: '确认提交', description: '核对结构和金额后提交' },
];

const COMPACT_STEPS: Array<{ id: CompactStepId; label: string; description: string }> = [
  { id: 'basic', label: '基础信息', description: '订单和客户' },
  { id: 'structure', label: '结构录入', description: '空间/产品/拆单任务' },
  { id: 'attachments', label: '附件备注', description: '图纸和说明' },
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

const SPECIFICATION_OPTIONS = [
  '全屋定制柜体',
  '平开门衣柜',
  '移门衣柜',
  '橱柜地柜',
  '橱柜吊柜',
  '门板',
  '柜体板件',
  '五金套件',
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

const PROCESS_OPTIONS = [
  '开料',
  '封边',
  '打孔',
  '冷压',
  '贴皮',
  '打磨',
  '喷漆',
  '组装',
  '安装',
  '包装',
  '发货',
] as const;

const TASK_NAME_OPTIONS = [
  '侧板 A',
  '背板 B',
  '门板 C',
  '顶板',
  '底板',
  '层板',
  '铰链 / 拉手',
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

function tenantName(tenant: TenantOption): string {
  return tenant.company_name || tenant.name || tenant.id;
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
      if (isBlank(item.material)) missing.push('材质');
      if (isBlank(item.specification)) missing.push('规格/型号');
      if (!hasPositiveNumber(item.length_mm) || !hasPositiveNumber(item.width_mm) || !hasPositiveNumber(item.thickness_mm)) {
        missing.push('长宽厚尺寸');
      }
      if (isBlank(item.color)) missing.push('颜色');
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
        if (task.task_type !== 'hardware' && isBlank(task.process_name)) missing.push('工序');
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
    color: '',
    process_name: '',
    construction_surface: '',
    hardware: '',
    hardware_quantity: undefined,
    remark: '',
    attachments: [],
    ...overrides,
  };
}

function cabinetTasks(): ProductionTaskDraftFormValues[] {
  return [
    defaultTask({ task_type: 'board', task_name: '侧板 A', quantity: 2, unit: '块', process_name: '开料' }),
    defaultTask({ task_type: 'board', task_name: '背板 B', quantity: 1, unit: '块', process_name: '开料' }),
    defaultTask({ task_type: 'door', task_name: '门板 C', quantity: 2, unit: '扇', process_name: '门板加工' }),
    defaultTask({ task_type: 'hardware', task_name: '铰链 / 拉手', quantity: 1, unit: '套', hardware: '铰链、拉手' }),
    defaultTask({ task_type: 'process', task_name: '开料拆单任务', quantity: 1, unit: '项', process_name: '开料' }),
    defaultTask({ task_type: 'process', task_name: '封边拆单任务', quantity: 1, unit: '项', process_name: '封边' }),
    defaultTask({ task_type: 'process', task_name: '打孔拆单任务', quantity: 1, unit: '项', process_name: '打孔' }),
    defaultTask({ task_type: 'process', task_name: '组装拆单任务', quantity: 1, unit: '项', process_name: '组装' }),
    defaultTask({ task_type: 'package', task_name: '包装拆单任务', quantity: 1, unit: '项', process_name: '包装' }),
  ];
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

function cabinetModule(): OrderModuleFormValues {
  return {
    module_name: '主卧',
    remark: '',
    items: [{
      ...defaultItem(),
      product_name: '衣柜',
      product_type: '衣柜',
      specification: '全屋定制柜体',
      material: '多层板',
      unit: '套',
      tasks: cabinetTasks(),
    }],
  };
}

function emptyForm(mode: OrderMode): OrderFormValues {
  return {
    order_no: '',
    order_flow: orderFlowForMode(mode),
    to_tenant_id: '',
    target_factory_id: '',
    parent_order_id: '',
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

function selectedNodeLabel(node: SelectedNode, values: OrderFormValues): string {
  if (node.type === 'order') return '订单基础信息';
  const orderModule = values.modules[node.moduleIndex];
  const spaceLabel = orderModule?.module_name || `空间 #${node.moduleIndex + 1}`;
  if (node.type === 'space') return spaceLabel;
  const item = orderModule?.items[node.itemIndex];
  const productLabel = item?.product_name || `产品 #${node.itemIndex + 1}`;
  if (node.type === 'product') return `${spaceLabel} / ${productLabel}`;
  const task = item?.tasks[node.taskIndex];
  return `${spaceLabel} / ${productLabel} / ${task?.task_name || `拆单任务 #${node.taskIndex + 1}`}`;
}

function compactStepForStep(step: StepId): CompactStepId {
  if (step === 'attachments' || step === 'confirm') return step;
  if (step === 'basic') return 'basic';
  return 'structure';
}

function missingForOrder(values: OrderFormValues): string[] {
  const missing: string[] = [];
  if (isBlank(values.order_no)) missing.push('订单编号');
  if (isBlank(values.to_tenant_id)) missing.push('工厂企业');
  if (isBlank(values.customer_name)) missing.push('客户名称');
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
  if (!item || isBlank(item.material)) missing.push('材质');
  if (!item || isBlank(item.specification)) missing.push('规格/型号');
  if (!item || !hasPositiveNumber(item.length_mm) || !hasPositiveNumber(item.width_mm) || !hasPositiveNumber(item.thickness_mm)) missing.push('长宽厚');
  if (!item || !hasPositiveNumber(item.quantity)) missing.push('数量');
  if (!item || isBlank(item.unit)) missing.push('单位');
  if (!item || isBlank(item.color)) missing.push('颜色');
  return missing;
}

function missingForTask(task: ProductionTaskDraftFormValues | undefined): string[] {
  const missing: string[] = [];
  if (!task || isBlank(task.task_name)) missing.push('拆单任务名称');
  if (!task || !hasPositiveNumber(task.quantity)) missing.push('数量');
  if (!task || isBlank(task.unit)) missing.push('单位');
  if (!task || isBlank(task.process_name)) missing.push('工序');
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
  partnerLabel,
  parentOrders,
  onOpenChange,
  onSuccess,
}: CreateOrderDialogProps) {
  const [partners, setPartners] = useState<TenantOption[]>([]);
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [partnerSearch, setPartnerSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [generatingOrderNo, setGeneratingOrderNo] = useState(false);
  const [selectedPartnerName, setSelectedPartnerName] = useState('');
  const [showIncompleteDetails, setShowIncompleteDetails] = useState(false);
  const [activeStep, setActiveStep] = useState<StepId>('basic');
  const [selectedNode, setSelectedNode] = useState<SelectedNode>({ type: 'order' });
  const [selectedModuleIndex, setSelectedModuleIndex] = useState(0);
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);

  const form = useForm<OrderFormValues, unknown, OrderFormValues>({
    resolver: zodResolver(orderFormSchema) as unknown as Resolver<OrderFormValues>,
    defaultValues: emptyForm(mode),
  });

  const modules = useFieldArray({
    control: form.control,
    name: 'modules',
  });

  const watchedModules = form.watch('modules') || [];
  const watchedValues = form.watch();
  const safeModuleIndex = Math.min(selectedModuleIndex, Math.max(0, watchedModules.length - 1));
  const selectedModule = watchedModules[safeModuleIndex];
  const safeItemIndex = Math.min(selectedItemIndex, Math.max(0, (selectedModule?.items.length || 1) - 1));
  const selectedItem = selectedModule?.items[safeItemIndex];
  const activeStepIndex = STEPS.findIndex((step) => step.id === activeStep);
  const compactStep = compactStepForStep(activeStep);
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

  const progressValue = Math.round(((activeStepIndex + 1) / STEPS.length) * 100);

  useEffect(() => {
    if (incompleteCount === 0) setShowIncompleteDetails(false);
  }, [incompleteCount]);

  const selectStructureNode = useCallback((node: SelectedNode) => {
    setSelectedNode(node);
    if (node.type === 'order') {
      setActiveStep('basic');
      return;
    }
    setSelectedModuleIndex(node.moduleIndex);
    if (node.type === 'space') {
      setSelectedItemIndex(0);
      setActiveStep('spaces');
      return;
    }
    setSelectedItemIndex(node.itemIndex);
    setActiveStep(node.type === 'product' ? 'products' : 'tasks');
  }, []);

  const activateStep = useCallback((step: StepId) => {
    const modulesSnapshot = form.getValues('modules') || [];
    const nextNode = nodeForStep(step, modulesSnapshot, selectedNode);
    setSelectedNode(nextNode);
    if (nextNode.type === 'order') {
      setSelectedModuleIndex(0);
      setSelectedItemIndex(0);
    } else {
      setSelectedModuleIndex(nextNode.moduleIndex);
      setSelectedItemIndex(nextNode.type === 'space' ? 0 : nextNode.itemIndex);
    }
    setActiveStep(step);
  }, [form, selectedNode]);

  const updateModules = useCallback((updater: (modules: OrderModuleFormValues[]) => OrderModuleFormValues[], nextNode?: SelectedNode) => {
    const nextModules = updater(cloneModules(form.getValues('modules') || []));
    form.setValue('modules', nextModules, { shouldDirty: true, shouldValidate: true });
    if (nextNode) selectStructureNode(normalizeSelectedNode(nextNode, nextModules));
  }, [form, selectStructureNode]);

  const fetchPartners = useCallback(async (search?: string) => {
    const params = new URLSearchParams({ mode });
    if (search) params.set('search', search);
    const response = await fetch(`/api/order-partners?${params.toString()}`);
    const data = await response.json();
    if (data.success) setPartners(data.partners || []);
    else toast.error(data.error || '获取协作企业失败');
  }, [mode]);

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
    setSelectedPartnerName('');
    setActiveStep('basic');
    setSelectedNode({ type: 'order' });
    setSelectedModuleIndex(0);
    setSelectedItemIndex(0);
    fetchPartners();
    generateOrderNo();
  }, [fetchPartners, form, generateOrderNo, mode, open]);

  useEffect(() => {
    const normalized = normalizeSelectedNode(selectedNode, watchedModules);
    if (selectedNodeKey(normalized) !== selectedNodeKey(selectedNode)) {
      selectStructureNode(normalized);
    }
  }, [selectStructureNode, selectedNode, watchedModules]);

  const selectPartner = (partner: TenantOption) => {
    form.setValue('to_tenant_id', partner.id, { shouldValidate: true });
    form.setValue('target_factory_id', partner.id);
    setSelectedPartnerName(tenantName(partner));
    setPartnerOpen(false);
    setPartnerSearch('');
  };

  const applyCabinetTemplate = () => {
    form.setValue('modules', [cabinetModule()], { shouldDirty: true, shouldValidate: true });
    setSelectedModuleIndex(0);
    setSelectedItemIndex(0);
    setSelectedNode({ type: 'task', moduleIndex: 0, itemIndex: 0, taskIndex: 0 });
    setActiveStep('tasks');
    toast.success('已生成柜子订单拆单模板，可继续编辑');
  };

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

  const addTaskAfter = (moduleIndex: number, itemIndex: number, taskIndex: number) => {
    updateModules((current) => {
      current[moduleIndex]?.items[itemIndex]?.tasks.splice(taskIndex + 1, 0, defaultTask());
      return current;
    }, { type: 'task', moduleIndex, itemIndex, taskIndex: taskIndex + 1 });
  };

  const addCabinetTasks = (moduleIndex: number, itemIndex: number) => {
    const startIndex = watchedModules[moduleIndex]?.items[itemIndex]?.tasks.length || 0;
    updateModules((current) => {
      current[moduleIndex]?.items[itemIndex]?.tasks.push(...cabinetTasks());
      return current;
    }, { type: 'task', moduleIndex, itemIndex, taskIndex: startIndex });
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

  const saveDraft = () => {
    window.localStorage.setItem(`erp-create-order-draft:${mode}`, JSON.stringify(form.getValues()));
    toast.success('草稿已保存在当前浏览器');
  };

  const jumpToFirstIncomplete = () => {
    const currentValues = form.getValues();
    const first = mergeIncompleteNodes(collectIncompleteNodes(currentValues))[0];
    if (!first) {
      setShowIncompleteDetails(false);
      toast.success('当前订单结构已完整');
      return;
    }
    setShowIncompleteDetails(true);
    selectStructureNode(first.node);
    toast.warning(`${selectedNodeLabel(first.node, currentValues)} 缺少：${first.missing.join('、')}`);
  };

  const reviewBeforeSubmit = async () => {
    const currentValues = form.getValues();
    const currentIncompleteNodes = mergeIncompleteNodes(collectIncompleteNodes(currentValues));
    if (currentIncompleteNodes.length > 0) {
      const first = currentIncompleteNodes[0];
      setShowIncompleteDetails(true);
      selectStructureNode(first.node);
      toast.warning(`还有 ${currentIncompleteNodes.length} 处未完整，请先补齐缺项`);
      return;
    }
    setShowIncompleteDetails(false);
    await goToStep('confirm');
  };

  const validateStep = async (step: StepId): Promise<boolean> => {
    if (step === 'basic') {
      const valid = await form.trigger(['order_no', 'to_tenant_id', 'customer_name']);
      if (!valid) toast.error('请先填写订单编号、接收企业和客户信息');
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
        body: JSON.stringify(values),
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
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <DialogTitle className="text-xl">
                  {mode === 'factory_material' ? '创建材料订单' : '创建经销商订单'}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  左侧按订单树定位对象，右侧编辑当前选中的订单、空间、产品或拆单任务。
                </DialogDescription>
              </div>
              <Button type="button" variant="outline" className="gap-2" onClick={applyCabinetTemplate}>
                <Sparkles className="h-4 w-4" />
                柜子订单模板
              </Button>
            </div>
            <CompactOrderProgress
              activeStep={compactStep}
              progressValue={progressValue}
              onSelect={goToCompactStep}
            />
          </div>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="grid min-h-0 bg-muted/10 lg:grid-cols-[360px_minmax(0,1fr)] 2xl:grid-cols-[420px_minmax(0,1fr)]">
          <aside className="min-h-0 border-r bg-muted/30">
            <ScrollArea className="h-[calc(100vh-216px)]">
              <OrderStructureSidebar
                values={watchedValues}
                selectedNode={normalizedSelectedNode}
                incompleteNodes={incompleteNodes}
                receiverName={selectedPartnerName}
                totalAmount={totalAmount}
                onSelectNode={selectStructureNode}
                onAddSpace={addSpace}
                onAddSpaceAfter={addSpaceAfter}
                onApplyCabinetTemplate={applyCabinetTemplate}
                onRemoveSpace={removeSpace}
                onAddProduct={addProduct}
                onRemoveProduct={removeProduct}
                onAddTask={(moduleIndex, itemIndex) => addTask(moduleIndex, itemIndex)}
                onAddTaskAfter={addTaskAfter}
                onAddCabinetTasks={addCabinetTasks}
                onRemoveTask={removeTask}
              />
            </ScrollArea>
          </aside>

          <div className="flex min-h-0 flex-col bg-background">
            <ScrollArea className="h-[calc(100vh-288px)]">
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

                {activeStep !== 'attachments' && activeStep !== 'confirm' ? (
                  <NodeEditorPanel
                    form={form}
                    mode={mode}
                    partnerLabel={partnerLabel}
                    parentOrders={parentOrders}
                    partners={partners}
                    partnerOpen={partnerOpen}
                    partnerSearch={partnerSearch}
                    generatingOrderNo={generatingOrderNo}
                    selectedPartnerName={selectedPartnerName}
                    selectedNode={normalizedSelectedNode}
                    modules={watchedModules}
                    onPartnerOpenChange={setPartnerOpen}
                    onPartnerSearchChange={(value) => {
                      setPartnerSearch(value);
                      fetchPartners(value);
                    }}
                    onSelectPartner={selectPartner}
                    onGenerateOrderNo={generateOrderNo}
                    onAddSpace={addSpace}
                    onApplyCabinetTemplate={applyCabinetTemplate}
                    onSelectNode={selectStructureNode}
                    onRemoveSpace={removeSpace}
                    onAddProduct={addProduct}
                    onCopyProduct={copyProduct}
                    onRemoveProduct={removeProduct}
                    onAddTask={(moduleIndex, itemIndex) => addTask(moduleIndex, itemIndex)}
                    onAddCabinetTasks={addCabinetTasks}
                    onCopyTask={copyTask}
                    onRemoveTask={removeTask}
                  />
                ) : null}
              </div>
            </ScrollArea>

            <DialogFooter className="items-center justify-between gap-3 border-t bg-background px-8 py-5 sm:justify-between">
              <div className="min-w-0 flex-1 text-sm text-muted-foreground">
                {incompleteCount > 0 ? (
                  <>
                    <Button type="button" variant="outline" size="sm" onClick={jumpToFirstIncomplete}>
                      还有 {incompleteCount} 处未完整，查看缺项
                    </Button>
                    {showIncompleteDetails ? (
                      <IncompleteDetailsList
                        values={watchedValues}
                        incompleteNodes={incompleteNodes}
                        onSelectNode={selectStructureNode}
                      />
                    ) : null}
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1 text-emerald-600"><CircleCheck className="h-4 w-4" />结构已完整</span>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
                <Button type="button" variant="outline" onClick={goPrev} disabled={activeStepIndex <= 0}>上一步</Button>
                <Button type="button" variant="outline" onClick={() => void goNext()} disabled={activeStep === 'confirm'}>下一步</Button>
                <Button type="button" variant="outline" onClick={saveDraft}>保存草稿</Button>
                {activeStep !== 'confirm' ? (
                  <Button type="button" onClick={() => void reviewBeforeSubmit()}>核对提交</Button>
                ) : null}
                <Button type="submit" disabled={submitting} className="min-w-[112px] gap-2">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {submitting ? '提交中...' : '直接提交'}
                </Button>
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
  partnerLabel,
  parentOrders,
  partners,
  partnerOpen,
  partnerSearch,
  generatingOrderNo,
  selectedPartnerName,
  onPartnerOpenChange,
  onPartnerSearchChange,
  onSelectPartner,
  onGenerateOrderNo,
}: {
  form: UseFormReturn<OrderFormValues, unknown, OrderFormValues>;
  mode: OrderMode;
  partnerLabel: string;
  parentOrders: Order[];
  partners: TenantOption[];
  partnerOpen: boolean;
  partnerSearch: string;
  generatingOrderNo: boolean;
  selectedPartnerName: string;
  onPartnerOpenChange: (open: boolean) => void;
  onPartnerSearchChange: (value: string) => void;
  onSelectPartner: (partner: TenantOption) => void;
  onGenerateOrderNo: () => void;
}) {
  return (
    <section className="space-y-5">
      <StepTitle icon={<ClipboardList className="h-5 w-5" />} title="基础信息" description="先确定订单编号、接收企业和交付要求。" />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="订单编号 *" error={form.formState.errors.order_no?.message}>
          <div className="flex gap-2">
            <Input {...form.register('order_no')} className="font-mono" placeholder="订单编号" />
            <Button type="button" variant="outline" size="icon" onClick={onGenerateOrderNo} disabled={generatingOrderNo}>
              {generatingOrderNo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </Field>

        <Field label={`${partnerLabel} *`} error={form.formState.errors.to_tenant_id?.message}>
          <Popover open={partnerOpen} onOpenChange={onPartnerOpenChange}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={partnerOpen}
                className="w-full justify-between font-normal"
              >
                {selectedPartnerName || `选择${partnerLabel}...`}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[380px] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder={`搜索${partnerLabel}...`}
                  value={partnerSearch}
                  onValueChange={onPartnerSearchChange}
                />
                <CommandList>
                  <CommandEmpty>未找到{partnerLabel}</CommandEmpty>
                  <CommandGroup>
                    {partners.map((partner) => (
                      <CommandItem key={partner.id} value={partner.id} onSelect={() => onSelectPartner(partner)}>
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            form.watch('to_tenant_id') === partner.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <div>
                          <p className="font-medium">{tenantName(partner)}</p>
                          <p className="text-xs text-muted-foreground">
                            {partner.contact_phone || partner.contact_person || partner.tenant_type || '-'}
                          </p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
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

        <Field label="客户名称 *" error={form.formState.errors.customer_name?.message}>
          <Input {...form.register('customer_name')} placeholder="王先生 / 张女士 / 项目名称" />
        </Field>

        <Field label="客户电话">
          <Input {...form.register('customer_phone')} placeholder="客户电话" />
        </Field>

        <Field label="发货地址">
          <Input {...form.register('customer_address')} placeholder="省 / 市 / 区 / 街道 / 门牌号" />
        </Field>

        <Field label="交付日期">
          <Input type="date" {...form.register('delivery_date')} />
        </Field>
      </div>

      <Field label="订单说明">
        <Textarea {...form.register('remark')} placeholder="填写订单要求、交付说明或协作备注" />
      </Field>
    </section>
  );
}

function SpacesStep({
  form,
  modules,
  selectedModuleIndex,
  onSelectModule,
  onApplyCabinetTemplate,
}: {
  form: UseFormReturn<OrderFormValues, unknown, OrderFormValues>;
  modules: ReturnType<typeof useFieldArray<OrderFormValues, 'modules'>>;
  selectedModuleIndex: number;
  onSelectModule: (index: number) => void;
  onApplyCabinetTemplate: () => void;
}) {
  return (
    <section className="space-y-5">
      <StepTitle icon={<Layers3 className="h-5 w-5" />} title="空间/房间" description="先搭好二级空间，再在空间下录入产品和拆单任务。" />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => modules.append(defaultModule('自定义空间'))}>
          <Plus className="mr-1 h-4 w-4" />新增空间
        </Button>
        <Button type="button" variant="secondary" onClick={onApplyCabinetTemplate}>
          <Sparkles className="mr-1 h-4 w-4" />套用柜子模板
        </Button>
      </div>
      <div className="grid gap-3">
        {modules.fields.map((moduleField, index) => {
          const error = form.formState.errors.modules?.[index]?.module_name?.message;
          return (
            <div key={moduleField.id} className={cn('rounded-lg border p-5 shadow-sm', selectedModuleIndex === index ? 'border-primary bg-primary/5' : 'bg-background')}>
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <Field label={`空间 #${index + 1} *`} error={error}>
                  <DatalistInput
                    listId={`module-presets-${index}`}
                    values={ORDER_MODULE_PRESETS}
                    {...form.register(`modules.${index}.module_name`)}
                    onFocus={() => onSelectModule(index)}
                    placeholder="主卧 / 厨房 / 客厅 / 自定义"
                  />
                </Field>
                <Field label="空间备注">
                  <Input {...form.register(`modules.${index}.remark`)} onFocus={() => onSelectModule(index)} placeholder="可选" />
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={modules.fields.length <= 1}
                  onClick={() => {
                    modules.remove(index);
                    onSelectModule(0);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ProductsStep({
  form,
  moduleIndex,
  selectedItemIndex,
  onSelectItem,
}: {
  form: UseFormReturn<OrderFormValues, unknown, OrderFormValues>;
  moduleIndex: number;
  selectedItemIndex: number;
  onSelectItem: (index: number) => void;
}) {
  const items = useFieldArray({
    control: form.control,
    name: `modules.${moduleIndex}.items`,
  });

  return (
    <section className="space-y-5">
      <StepTitle icon={<Package className="h-5 w-5" />} title="产品/柜体" description="录入三级产品对象，比如衣柜、地柜、门板或五金。" />
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">当前空间：{form.watch(`modules.${moduleIndex}.module_name`) || `空间 #${moduleIndex + 1}`}</div>
        <Button type="button" variant="outline" onClick={() => {
          items.append(defaultItem());
          onSelectItem(items.fields.length);
        }}>
          <Plus className="mr-1 h-4 w-4" />新增产品
        </Button>
      </div>
      <div className="space-y-4">
        {items.fields.map((itemField, itemIndex) => (
          <ProductFields
            key={itemField.id}
            form={form}
            moduleIndex={moduleIndex}
            itemIndex={itemIndex}
            selected={selectedItemIndex === itemIndex}
            canRemove={items.fields.length > 1}
            onFocus={() => onSelectItem(itemIndex)}
            onRemove={() => {
              items.remove(itemIndex);
              onSelectItem(0);
            }}
          />
        ))}
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
        <Field className="md:col-span-3" label="材质">
          <DatalistInput
            listId={`product-material-${moduleIndex}-${itemIndex}`}
            values={MATERIAL_OPTIONS}
            {...form.register(`${baseName}.material`)}
            placeholder="多层板 / 实木 / 木皮"
          />
        </Field>
        <Field className="md:col-span-3" label="规格/型号">
          <DatalistInput
            listId={`product-spec-${moduleIndex}-${itemIndex}`}
            values={SPECIFICATION_OPTIONS}
            {...form.register(`${baseName}.specification`)}
            placeholder="补充规格，也可自定义"
          />
        </Field>

        <Field className="md:col-span-2" label="长度 mm">
          <Input type="number" min={0} step="0.1" {...form.register(`${baseName}.length_mm`)} />
        </Field>
        <Field className="md:col-span-2" label="宽度 mm">
          <Input type="number" min={0} step="0.1" {...form.register(`${baseName}.width_mm`)} />
        </Field>
        <Field className="md:col-span-2" label="厚度 mm">
          <Input type="number" min={0} step="0.1" {...form.register(`${baseName}.thickness_mm`)} />
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

        <Field className="md:col-span-3" label="颜色">
          <DatalistInput
            listId={`product-color-${moduleIndex}-${itemIndex}`}
            values={COLOR_OPTIONS}
            {...form.register(`${baseName}.color`)}
            placeholder="暖白 / 原木色"
          />
        </Field>
        <Field className="md:col-span-3" label="木工工艺">
          <DatalistInput listId={`wood-${moduleIndex}-${itemIndex}`} values={WOODWORKING_CRAFT_OPTIONS} {...form.register(`${baseName}.woodworking_craft`)} placeholder="免拉手" />
        </Field>
        <Field className="md:col-span-3" label="成型工艺">
          <DatalistInput listId={`forming-${moduleIndex}-${itemIndex}`} values={FORMING_CRAFT_OPTIONS} {...form.register(`${baseName}.forming_craft`)} placeholder="冷压制" />
        </Field>
        <Field className="md:col-span-3" label="烤漆工艺">
          <DatalistInput listId={`painting-${moduleIndex}-${itemIndex}`} values={PAINTING_CRAFT_OPTIONS} {...form.register(`${baseName}.painting_craft`)} placeholder="混油 / 贴皮" />
        </Field>

        <Field className="md:col-span-3" label="五金">
          <DatalistInput
            listId={`product-hardware-${moduleIndex}-${itemIndex}`}
            values={HARDWARE_OPTIONS}
            {...form.register(`${baseName}.hardware`)}
            placeholder="铰链 / 拉手 / 滑轨"
          />
        </Field>
        <Field className="md:col-span-2" label="五金数量">
          <Input type="number" min={0} step="1" {...form.register(`${baseName}.hardware_quantity`)} />
        </Field>
        <Field className="md:col-span-3" label="施工面">
          <DatalistInput listId={`surface-${moduleIndex}-${itemIndex}`} values={CONSTRUCTION_SURFACE_OPTIONS} {...form.register(`${baseName}.construction_surface`)} placeholder="一面四边" />
        </Field>
        <Field className="md:col-span-4" label="产品备注">
          <Input {...form.register(`${baseName}.remark`)} placeholder="补充说明" />
        </Field>
      </div>
    </div>
  );
}

function TasksStep({
  form,
  moduleIndex,
  itemIndex,
}: {
  form: UseFormReturn<OrderFormValues, unknown, OrderFormValues>;
  moduleIndex: number;
  itemIndex: number;
}) {
  const tasks = useFieldArray({
    control: form.control,
    name: `modules.${moduleIndex}.items.${itemIndex}.tasks`,
  });
  const itemName = form.watch(`modules.${moduleIndex}.items.${itemIndex}.product_name`);

  return (
    <section className="space-y-5">
      <StepTitle icon={<Workflow className="h-5 w-5" />} title="拆单任务" description="经销商可手动录入板件、五金、工序等生产草稿，等待工厂确认。" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">当前产品：{itemName || `产品 #${itemIndex + 1}`}</div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => cabinetTasks().forEach((task) => tasks.append(task))}>
            <Sparkles className="mr-1 h-4 w-4" />生成柜子拆单任务
          </Button>
          <Button type="button" variant="outline" onClick={() => tasks.append(defaultTask())}>
            <Plus className="mr-1 h-4 w-4" />新增拆单任务
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {tasks.fields.map((taskField, taskIndex) => (
          <TaskFields
            key={taskField.id}
            form={form}
            moduleIndex={moduleIndex}
            itemIndex={itemIndex}
            taskIndex={taskIndex}
            onRemove={() => tasks.remove(taskIndex)}
          />
        ))}
        {tasks.fields.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            尚未录入拆单任务。可以手动新增，也可以一键生成柜子拆单任务后再调整。
          </div>
        ) : null}
      </div>
    </section>
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

  return (
    <div className="space-y-5 rounded-lg border bg-background p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="font-medium">拆单任务 #{taskIndex + 1}</div>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-12">
        <Field className="md:col-span-3" label="拆单任务类型">
          <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" {...form.register(`${baseName}.task_type`)}>
            {PRODUCTION_TASK_TYPES.map((type) => <option key={type} value={type}>{TASK_TYPE_LABELS[type]}</option>)}
          </select>
        </Field>
        <Field className="md:col-span-3" label="拆单任务名称 *" error={errors?.task_name?.message}>
          <DatalistInput
            listId={`task-name-${moduleIndex}-${itemIndex}-${taskIndex}`}
            values={TASK_NAME_OPTIONS}
            {...form.register(`${baseName}.task_name`)}
            placeholder="侧板 A / 封边拆单任务"
          />
        </Field>
        <Field className="md:col-span-2" label="数量 *" error={errors?.quantity?.message}>
          <Input type="number" min={0.01} step="0.01" {...form.register(`${baseName}.quantity`)} />
        </Field>
        <Field className="md:col-span-2" label="单位">
          <DatalistInput
            listId={`task-unit-${moduleIndex}-${itemIndex}-${taskIndex}`}
            values={ORDER_UNITS}
            {...form.register(`${baseName}.unit`)}
            placeholder="块 / 项 / 套"
          />
        </Field>
        <Field className="md:col-span-2" label="工序">
          <DatalistInput
            listId={`task-process-${moduleIndex}-${itemIndex}-${taskIndex}`}
            values={PROCESS_OPTIONS}
            {...form.register(`${baseName}.process_name`)}
            placeholder="开料 / 封边"
          />
        </Field>

        <Field className="md:col-span-2" label="长度 mm">
          <Input type="number" min={0} step="0.1" {...form.register(`${baseName}.length_mm`)} />
        </Field>
        <Field className="md:col-span-2" label="宽度 mm">
          <Input type="number" min={0} step="0.1" {...form.register(`${baseName}.width_mm`)} />
        </Field>
        <Field className="md:col-span-2" label="厚度 mm">
          <Input type="number" min={0} step="0.1" {...form.register(`${baseName}.thickness_mm`)} />
        </Field>
        <Field className="md:col-span-2" label="面积">
          <Input type="number" min={0} step="0.01" {...form.register(`${baseName}.area`)} />
        </Field>
        <Field className="md:col-span-2" label="材质">
          <DatalistInput
            listId={`task-material-${moduleIndex}-${itemIndex}-${taskIndex}`}
            values={MATERIAL_OPTIONS}
            {...form.register(`${baseName}.material`)}
            placeholder="多层板"
          />
        </Field>
        <Field className="md:col-span-2" label="颜色">
          <DatalistInput
            listId={`task-color-${moduleIndex}-${itemIndex}-${taskIndex}`}
            values={COLOR_OPTIONS}
            {...form.register(`${baseName}.color`)}
            placeholder="暖白"
          />
        </Field>

        <Field className="md:col-span-3" label="施工面">
          <DatalistInput listId={`task-surface-${moduleIndex}-${itemIndex}-${taskIndex}`} values={CONSTRUCTION_SURFACE_OPTIONS} {...form.register(`${baseName}.construction_surface`)} placeholder="一面四边" />
        </Field>
        <Field className="md:col-span-3" label="五金">
          <DatalistInput
            listId={`task-hardware-${moduleIndex}-${itemIndex}-${taskIndex}`}
            values={HARDWARE_OPTIONS}
            {...form.register(`${baseName}.hardware`)}
            placeholder="铰链 / 拉手"
          />
        </Field>
        <Field className="md:col-span-2" label="五金数量">
          <Input type="number" min={0} step="1" {...form.register(`${baseName}.hardware_quantity`)} />
        </Field>
        <Field className="md:col-span-4" label="拆单任务备注">
          <Input {...form.register(`${baseName}.remark`)} placeholder="补充要求" />
        </Field>
      </div>
    </div>
  );
}

function AttachmentsStep({
  form,
  modules,
}: {
  form: UseFormReturn<OrderFormValues, unknown, OrderFormValues>;
  modules: OrderModuleFormValues[];
}) {
  return (
    <section className="space-y-5">
      <StepTitle icon={<Paperclip className="h-5 w-5" />} title="附件备注" description="上传图纸、现场照片或说明文件，附件归属到产品明细。" />
      <div className="space-y-4">
        {modules.map((module, moduleIndex) => (
          <div key={`${module.module_name}-${moduleIndex}`} className="rounded-lg border bg-background p-5 shadow-sm">
            <div className="mb-3 font-medium">{module.module_name || `空间 #${moduleIndex + 1}`}</div>
            <div className="space-y-3">
              {module.items.map((item, itemIndex) => (
                <AttachmentControl
                  key={`${item.product_name}-${itemIndex}`}
                  form={form}
                  moduleIndex={moduleIndex}
                  itemIndex={itemIndex}
                />
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
  progressValue,
  onSelect,
}: {
  activeStep: CompactStepId;
  progressValue: number;
  onSelect: (step: CompactStepId) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px] md:items-center">
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
            <div className="text-sm font-medium">{index + 1}. {step.label}</div>
            <div className="text-xs text-muted-foreground">{step.description}</div>
          </button>
        ))}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>录入进度</span>
          <span>{progressValue}%</span>
        </div>
        <Progress value={progressValue} />
      </div>
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
  receiverName,
  totalAmount,
  onSelectNode,
  onAddSpace,
  onAddSpaceAfter,
  onApplyCabinetTemplate,
  onRemoveSpace,
  onAddProduct,
  onRemoveProduct,
  onAddTask,
  onAddTaskAfter,
  onAddCabinetTasks,
  onRemoveTask,
}: {
  values: OrderFormValues;
  selectedNode: SelectedNode;
  incompleteNodes: IncompleteNode[];
  receiverName: string;
  totalAmount: number;
  onSelectNode: (node: SelectedNode) => void;
  onAddSpace: () => void;
  onAddSpaceAfter: (moduleIndex: number) => void;
  onApplyCabinetTemplate: () => void;
  onRemoveSpace: (moduleIndex: number) => void;
  onAddProduct: (moduleIndex: number) => void;
  onRemoveProduct: (moduleIndex: number, itemIndex: number) => void;
  onAddTask: (moduleIndex: number, itemIndex: number) => void;
  onAddTaskAfter: (moduleIndex: number, itemIndex: number, taskIndex: number) => void;
  onAddCabinetTasks: (moduleIndex: number, itemIndex: number) => void;
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
          <Button type="button" variant="secondary" size="sm" onClick={onApplyCabinetTemplate}>
            <Sparkles className="mr-1 h-3.5 w-3.5" />柜子模板
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
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => onAddTask(moduleIndex, itemIndex)}
                            className="flex flex-1 items-center gap-2 rounded-md border border-dashed px-2 py-2 text-left text-xs text-muted-foreground transition hover:border-primary hover:bg-primary/5 hover:text-primary"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            新增拆单任务
                          </button>
                          <TreeIconButton label="生成柜子拆单任务" onClick={() => onAddCabinetTasks(moduleIndex, itemIndex)} icon={<Sparkles className="h-3.5 w-3.5" />} />
                        </div>
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
        receiverName={receiverName}
        customerName={values.customer_name}
        modules={values.modules}
        totalAmount={totalAmount}
      />
    </div>
  );
}

function IncompleteDetailsList({
  values,
  incompleteNodes,
  onSelectNode,
}: {
  values: OrderFormValues;
  incompleteNodes: IncompleteNode[];
  onSelectNode: (node: SelectedNode) => void;
}) {
  const visibleNodes = incompleteNodes.slice(0, 8);
  const hiddenCount = Math.max(0, incompleteNodes.length - visibleNodes.length);

  return (
    <div className="mt-2 max-h-32 max-w-[520px] overflow-y-auto rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950 shadow-sm">
      <div className="mb-1 font-medium">缺项清单</div>
      <div className="space-y-1">
        {visibleNodes.map((item) => (
          <button
            key={selectedNodeKey(item.node)}
            type="button"
            onClick={() => onSelectNode(item.node)}
            className="block w-full rounded px-2 py-1 text-left transition hover:bg-amber-100"
          >
            <span className="font-medium">{selectedNodeLabel(item.node, values)}</span>
            <span className="ml-1 text-amber-800">缺少：{item.missing.join('、')}</span>
          </button>
        ))}
      </div>
      {hiddenCount > 0 ? (
        <div className="mt-1 px-2 text-amber-800">还有 {hiddenCount} 处缺项，继续补齐后会自动减少。</div>
      ) : null}
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
  partnerLabel,
  parentOrders,
  partners,
  partnerOpen,
  partnerSearch,
  generatingOrderNo,
  selectedPartnerName,
  selectedNode,
  modules,
  onPartnerOpenChange,
  onPartnerSearchChange,
  onSelectPartner,
  onGenerateOrderNo,
  onAddSpace,
  onApplyCabinetTemplate,
  onSelectNode,
  onRemoveSpace,
  onAddProduct,
  onCopyProduct,
  onRemoveProduct,
  onAddTask,
  onAddCabinetTasks,
  onCopyTask,
  onRemoveTask,
}: {
  form: UseFormReturn<OrderFormValues, unknown, OrderFormValues>;
  mode: OrderMode;
  partnerLabel: string;
  parentOrders: Order[];
  partners: TenantOption[];
  partnerOpen: boolean;
  partnerSearch: string;
  generatingOrderNo: boolean;
  selectedPartnerName: string;
  selectedNode: SelectedNode;
  modules: OrderModuleFormValues[];
  onPartnerOpenChange: (open: boolean) => void;
  onPartnerSearchChange: (value: string) => void;
  onSelectPartner: (partner: TenantOption) => void;
  onGenerateOrderNo: () => void;
  onAddSpace: () => void;
  onApplyCabinetTemplate: () => void;
  onSelectNode: (node: SelectedNode) => void;
  onRemoveSpace: (moduleIndex: number) => void;
  onAddProduct: (moduleIndex: number) => void;
  onCopyProduct: (moduleIndex: number, itemIndex: number) => void;
  onRemoveProduct: (moduleIndex: number, itemIndex: number) => void;
  onAddTask: (moduleIndex: number, itemIndex: number) => void;
  onAddCabinetTasks: (moduleIndex: number, itemIndex: number) => void;
  onCopyTask: (moduleIndex: number, itemIndex: number, taskIndex: number) => void;
  onRemoveTask: (moduleIndex: number, itemIndex: number, taskIndex: number) => void;
}) {
  if (selectedNode.type === 'order') {
    return (
      <BasicStep
        form={form}
        mode={mode}
        partnerLabel={partnerLabel}
        parentOrders={parentOrders}
        partners={partners}
        partnerOpen={partnerOpen}
        partnerSearch={partnerSearch}
        generatingOrderNo={generatingOrderNo}
        selectedPartnerName={selectedPartnerName}
        onPartnerOpenChange={onPartnerOpenChange}
        onPartnerSearchChange={onPartnerSearchChange}
        onSelectPartner={onSelectPartner}
        onGenerateOrderNo={onGenerateOrderNo}
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
        onApplyCabinetTemplate={onApplyCabinetTemplate}
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
        onAddTask={() => onAddTask(selectedNode.moduleIndex, selectedNode.itemIndex)}
        onAddCabinetTasks={() => onAddCabinetTasks(selectedNode.moduleIndex, selectedNode.itemIndex)}
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
  onApplyCabinetTemplate,
}: {
  form: UseFormReturn<OrderFormValues, unknown, OrderFormValues>;
  moduleIndex: number;
  moduleCount: number;
  onAddProduct: () => void;
  onAddSpace: () => void;
  onRemove: () => void;
  onApplyCabinetTemplate: () => void;
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
        <Button type="button" variant="secondary" onClick={onApplyCabinetTemplate}>
          <Sparkles className="mr-1 h-4 w-4" />套用柜子模板
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
  onAddTask,
  onAddCabinetTasks,
  onCopy,
  onRemove,
  onSelectNode,
}: {
  form: UseFormReturn<OrderFormValues, unknown, OrderFormValues>;
  moduleIndex: number;
  itemIndex: number;
  canRemove: boolean;
  onAddTask: () => void;
  onAddCabinetTasks: () => void;
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
        <Button type="button" variant="outline" onClick={onAddTask}>
          <Plus className="mr-1 h-4 w-4" />新增拆单任务
        </Button>
        <Button type="button" variant="secondary" onClick={onAddCabinetTasks}>
          <Sparkles className="mr-1 h-4 w-4" />生成柜子拆单任务
        </Button>
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
  receiverName,
  customerName,
  modules,
  totalAmount,
}: {
  receiverName: string;
  customerName: string;
  modules: OrderModuleFormValues[];
  totalAmount: number;
}) {
  return (
    <div className="space-y-3 rounded-lg border bg-background p-4 text-sm shadow-sm">
      <div className="font-medium">当前摘要</div>
      <div className="grid grid-cols-2 gap-2 text-muted-foreground">
        <span>接收企业</span><span className="truncate text-right text-foreground">{receiverName || '-'}</span>
        <span>客户名称</span><span className="truncate text-right text-foreground">{customerName || '-'}</span>
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
  ...props
}: ComponentProps<typeof Input> & { listId: string; values: readonly string[] }) {
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
        <div className="flex gap-2">
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
  label: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-xs">{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
