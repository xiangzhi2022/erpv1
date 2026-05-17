'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { useFieldArray, useForm, type Resolver, type SubmitHandler, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Check,
  ChevronRight,
  ChevronsUpDown,
  ClipboardList,
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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

const STEPS: Array<{ id: StepId; label: string; description: string }> = [
  { id: 'basic', label: '基础信息', description: '订单编号、工厂企业和交付要求' },
  { id: 'spaces', label: '空间/房间', description: '主卧、厨房、客厅等二级结构' },
  { id: 'products', label: '产品/柜体', description: '衣柜、门板、柜体和基础规格' },
  { id: 'tasks', label: '四级任务', description: '板件、五金、工序、安装、包装' },
  { id: 'attachments', label: '附件备注', description: '产品图片、图纸和补充文件' },
  { id: 'confirm', label: '确认提交', description: '核对结构和金额后提交' },
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
  '开料任务',
  '封边任务',
  '打孔任务',
  '组装任务',
  '包装任务',
  '发货任务',
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

function isBlank(value: string | null | undefined): boolean {
  return !value?.trim();
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
        messages.push(`${productLabel}：还没有录入四级任务`);
        return;
      }
      item.tasks.forEach((task, taskIndex) => {
        const label = `${productLabel} / ${task.task_name || `任务 #${taskIndex + 1}`}`;
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
    defaultTask({ task_type: 'process', task_name: '开料任务', quantity: 1, unit: '项', process_name: '开料' }),
    defaultTask({ task_type: 'process', task_name: '封边任务', quantity: 1, unit: '项', process_name: '封边' }),
    defaultTask({ task_type: 'process', task_name: '打孔任务', quantity: 1, unit: '项', process_name: '打孔' }),
    defaultTask({ task_type: 'process', task_name: '组装任务', quantity: 1, unit: '项', process_name: '组装' }),
    defaultTask({ task_type: 'package', task_name: '包装任务', quantity: 1, unit: '项', process_name: '包装' }),
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
  const [activeStep, setActiveStep] = useState<StepId>('basic');
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
  const safeModuleIndex = Math.min(selectedModuleIndex, Math.max(0, watchedModules.length - 1));
  const selectedModule = watchedModules[safeModuleIndex];
  const safeItemIndex = Math.min(selectedItemIndex, Math.max(0, (selectedModule?.items.length || 1) - 1));
  const selectedItem = selectedModule?.items[safeItemIndex];
  const activeStepIndex = STEPS.findIndex((step) => step.id === activeStep);

  const totalAmount = useMemo(() => {
    return watchedModules.reduce((sum, module) => {
      return sum + module.items.reduce((itemSum, item) => {
        return itemSum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
      }, 0);
    }, 0);
  }, [watchedModules]);

  const progressValue = Math.round(((activeStepIndex + 1) / STEPS.length) * 100);

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
    setSelectedModuleIndex(0);
    setSelectedItemIndex(0);
    fetchPartners();
    generateOrderNo();
  }, [fetchPartners, form, generateOrderNo, mode, open]);

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
    setActiveStep('tasks');
    toast.success('已生成柜子四级订单模板，可继续编辑');
  };

  const validateStep = async (step: StepId): Promise<boolean> => {
    if (step === 'basic') {
      const valid = await form.trigger(['order_no', 'to_tenant_id', 'customer_name']);
      if (!valid) toast.error('请先填写订单编号、接收企业和客户信息');
      return valid;
    }
    if (step === 'spaces') {
      const valid = watchedModules.length > 0 && watchedModules.every((module) => module.module_name.trim());
      if (!valid) toast.error('请至少录入一个空间/房间名称');
      return valid;
    }
    if (step === 'products') {
      const valid = watchedModules.every((module) => (
        module.items.length > 0
        && module.items.every((item) => (
          item.product_name.trim()
          && hasPositiveNumber(item.quantity)
          && !isBlank(item.unit)
        ))
      ));
      if (!valid) {
        toast.error('每个空间至少需要一个产品，并填写产品名称、数量和单位');
        return false;
      }
      const incompleteMessages = productIncompleteMessages(watchedModules);
      if (incompleteMessages.length > 0) {
        return confirmIncompleteStep('产品/柜体数据还没有录入完整', incompleteMessages);
      }
      return true;
    }
    if (step === 'tasks') {
      const invalidTask = watchedModules.some((module) => (
        module.items.some((item) => item.tasks.some((task) => (
          !task.task_name.trim()
          || !hasPositiveNumber(task.quantity)
          || isBlank(task.unit)
        )))
      ));
      if (invalidTask) {
        toast.error('四级任务需要填写任务名称、数量和单位');
        return false;
      }
      const incompleteMessages = taskIncompleteMessages(watchedModules);
      if (incompleteMessages.length > 0) {
        return confirmIncompleteStep('四级任务数据还没有录入完整', incompleteMessages);
      }
      return true;
    }
    return true;
  };

  const goToStep = async (targetStep: StepId) => {
    const targetIndex = STEPS.findIndex((step) => step.id === targetStep);
    if (targetIndex <= activeStepIndex) {
      setActiveStep(targetStep);
      return;
    }
    for (let index = activeStepIndex; index < targetIndex; index += 1) {
      const valid = await validateStep(STEPS[index].id);
      if (!valid) return;
    }
    setActiveStep(targetStep);
  };

  const goNext = async () => {
    const next = STEPS[Math.min(STEPS.length - 1, activeStepIndex + 1)];
    await goToStep(next.id);
  };

  const goPrev = () => {
    const prev = STEPS[Math.max(0, activeStepIndex - 1)];
    setActiveStep(prev.id);
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
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <DialogTitle className="text-xl">
                {mode === 'factory_material' ? '创建材料订单' : '创建经销商订单'}
              </DialogTitle>
              <DialogDescription className="mt-1">
                作为订单录入入口，支持手动维护订单、空间、产品和四级生产草稿。
              </DialogDescription>
            </div>
            <Button type="button" variant="outline" className="gap-2" onClick={applyCabinetTemplate}>
              <Sparkles className="h-4 w-4" />
              柜子订单模板
            </Button>
          </div>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="grid min-h-0 bg-muted/10 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)] 2xl:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="min-h-0 border-r bg-muted/30">
            <ScrollArea className="h-[calc(100vh-190px)]">
              <div className="space-y-5 p-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">录入进度</span>
                    <span className="text-muted-foreground">{progressValue}%</span>
                  </div>
                  <Progress value={progressValue} />
                </div>

                <div className="space-y-2">
                  {STEPS.map((step, index) => (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => {
                        void goToStep(step.id);
                      }}
                      className={cn(
                        'w-full rounded-lg border px-4 py-3 text-left transition-colors',
                        activeStep === step.id ? 'border-primary bg-background shadow-sm' : 'border-transparent hover:bg-background/80'
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">{index + 1}. {step.label}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">{step.description}</div>
                        </div>
                        {activeStep === step.id ? <ChevronRight className="h-4 w-4 text-primary" /> : null}
                      </div>
                    </button>
                  ))}
                </div>

                <Separator />

                <OrderStructureTree
                  modules={watchedModules}
                  selectedModuleIndex={safeModuleIndex}
                  selectedItemIndex={safeItemIndex}
                  onSelectModule={(index) => {
                    setSelectedModuleIndex(index);
                    setSelectedItemIndex(0);
                    setActiveStep('products');
                  }}
                  onSelectItem={(moduleIndex, itemIndex) => {
                    setSelectedModuleIndex(moduleIndex);
                    setSelectedItemIndex(itemIndex);
                    setActiveStep('tasks');
                  }}
                  onSelectTask={(moduleIndex, itemIndex) => {
                    setSelectedModuleIndex(moduleIndex);
                    setSelectedItemIndex(itemIndex);
                    setActiveStep('tasks');
                  }}
                />

                <Separator />

                <SummaryBox
                  receiverName={selectedPartnerName}
                  customerName={form.watch('customer_name')}
                  modules={watchedModules}
                  totalAmount={totalAmount}
                />
              </div>
            </ScrollArea>
          </aside>

          <div className="flex min-h-0 flex-col bg-background">
            <ScrollArea className="h-[calc(100vh-262px)]">
              <div className="w-full space-y-6 p-5 xl:p-8">
                {activeStep === 'basic' ? (
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
                    onPartnerOpenChange={setPartnerOpen}
                    onPartnerSearchChange={(value) => {
                      setPartnerSearch(value);
                      fetchPartners(value);
                    }}
                    onSelectPartner={selectPartner}
                    onGenerateOrderNo={generateOrderNo}
                  />
                ) : null}

                {activeStep === 'spaces' ? (
                  <SpacesStep
                    form={form}
                    modules={modules}
                    selectedModuleIndex={safeModuleIndex}
                    onSelectModule={(index) => {
                      setSelectedModuleIndex(index);
                      setSelectedItemIndex(0);
                    }}
                    onApplyCabinetTemplate={applyCabinetTemplate}
                  />
                ) : null}

                {activeStep === 'products' ? (
                  <ProductsStep
                    form={form}
                    moduleIndex={safeModuleIndex}
                    selectedItemIndex={safeItemIndex}
                    onSelectItem={setSelectedItemIndex}
                  />
                ) : null}

                {activeStep === 'tasks' ? (
                  <TasksStep
                    form={form}
                    moduleIndex={safeModuleIndex}
                    itemIndex={safeItemIndex}
                  />
                ) : null}

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
              </div>
            </ScrollArea>

            <DialogFooter className="border-t bg-background px-8 py-5">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
              <Button type="button" variant="outline" onClick={goPrev} disabled={activeStepIndex === 0}>上一步</Button>
              {activeStep !== 'confirm' ? (
                <Button type="button" onClick={goNext}>下一步</Button>
              ) : (
                <Button type="submit" disabled={submitting} className="min-w-[112px] gap-2">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {submitting ? '提交中...' : '创建订单'}
                </Button>
              )}
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
      <StepTitle icon={<Layers3 className="h-5 w-5" />} title="空间/房间" description="先搭好二级空间，再在空间下录入产品和任务。" />
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
                  <Input
                    list={`module-presets-${index}`}
                    {...form.register(`modules.${index}.module_name`)}
                    onFocus={() => onSelectModule(index)}
                    placeholder="主卧 / 厨房 / 客厅 / 自定义"
                  />
                  <OptionList id={`module-presets-${index}`} values={ORDER_MODULE_PRESETS} />
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
          <Input list={`wood-${moduleIndex}-${itemIndex}`} {...form.register(`${baseName}.woodworking_craft`)} placeholder="免拉手" />
          <OptionList id={`wood-${moduleIndex}-${itemIndex}`} values={WOODWORKING_CRAFT_OPTIONS} />
        </Field>
        <Field className="md:col-span-3" label="成型工艺">
          <Input list={`forming-${moduleIndex}-${itemIndex}`} {...form.register(`${baseName}.forming_craft`)} placeholder="冷压制" />
          <OptionList id={`forming-${moduleIndex}-${itemIndex}`} values={FORMING_CRAFT_OPTIONS} />
        </Field>
        <Field className="md:col-span-3" label="烤漆工艺">
          <Input list={`painting-${moduleIndex}-${itemIndex}`} {...form.register(`${baseName}.painting_craft`)} placeholder="混油 / 贴皮" />
          <OptionList id={`painting-${moduleIndex}-${itemIndex}`} values={PAINTING_CRAFT_OPTIONS} />
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
          <Input list={`surface-${moduleIndex}-${itemIndex}`} {...form.register(`${baseName}.construction_surface`)} placeholder="一面四边" />
          <OptionList id={`surface-${moduleIndex}-${itemIndex}`} values={CONSTRUCTION_SURFACE_OPTIONS} />
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
      <StepTitle icon={<Workflow className="h-5 w-5" />} title="四级任务" description="经销商可手动录入板件、五金、工序等生产草稿，等待工厂确认。" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">当前产品：{itemName || `产品 #${itemIndex + 1}`}</div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => cabinetTasks().forEach((task) => tasks.append(task))}>
            <Sparkles className="mr-1 h-4 w-4" />生成柜子任务
          </Button>
          <Button type="button" variant="outline" onClick={() => tasks.append(defaultTask())}>
            <Plus className="mr-1 h-4 w-4" />新增任务
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
            尚未录入四级任务。可以手动新增，也可以一键生成柜子任务后再调整。
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
        <div className="font-medium">任务 #{taskIndex + 1}</div>
        <Button type="button" variant="ghost" size="icon" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-12">
        <Field className="md:col-span-3" label="任务类型">
          <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" {...form.register(`${baseName}.task_type`)}>
            {PRODUCTION_TASK_TYPES.map((type) => <option key={type} value={type}>{TASK_TYPE_LABELS[type]}</option>)}
          </select>
        </Field>
        <Field className="md:col-span-3" label="任务名称 *" error={errors?.task_name?.message}>
          <DatalistInput
            listId={`task-name-${moduleIndex}-${itemIndex}-${taskIndex}`}
            values={TASK_NAME_OPTIONS}
            {...form.register(`${baseName}.task_name`)}
            placeholder="侧板 A / 封边任务"
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
          <Input list={`task-surface-${moduleIndex}-${itemIndex}-${taskIndex}`} {...form.register(`${baseName}.construction_surface`)} placeholder="一面四边" />
          <OptionList id={`task-surface-${moduleIndex}-${itemIndex}-${taskIndex}`} values={CONSTRUCTION_SURFACE_OPTIONS} />
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
        <Field className="md:col-span-4" label="任务备注">
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
      <StepTitle icon={<Check className="h-5 w-5" />} title="确认提交" description="经销商录入的四级任务会作为生产草稿提交给工厂确认。" />
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="空间" value={`${modules.length}`} />
        <SummaryCard label="产品" value={`${countProducts(modules)}`} />
        <SummaryCard label="四级任务" value={`${countTasks(modules)}`} />
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
                      {item.tasks.length} 个四级任务 · {item.attachments.length} 个附件
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

function OrderStructureTree({
  modules,
  selectedModuleIndex,
  selectedItemIndex,
  onSelectModule,
  onSelectItem,
  onSelectTask,
}: {
  modules: OrderModuleFormValues[];
  selectedModuleIndex: number;
  selectedItemIndex: number;
  onSelectModule: (moduleIndex: number) => void;
  onSelectItem: (moduleIndex: number, itemIndex: number) => void;
  onSelectTask: (moduleIndex: number, itemIndex: number, taskIndex: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Layers3 className="h-4 w-4" />
        订单结构树
      </div>
      <div className="space-y-2 text-sm">
        {modules.map((module, moduleIndex) => (
          <div key={`${module.module_name}-${moduleIndex}`} className="space-y-1">
            <button
              type="button"
              onClick={() => onSelectModule(moduleIndex)}
              className={cn(
                'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-background',
                selectedModuleIndex === moduleIndex ? 'bg-background font-medium' : ''
              )}
            >
              <span>{module.module_name || `空间 #${moduleIndex + 1}`}</span>
              <Badge variant="secondary">{module.items.length}</Badge>
            </button>
            <div className="space-y-1 pl-4">
              {module.items.map((item, itemIndex) => (
                <div key={`${item.product_name}-${itemIndex}`} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => onSelectItem(moduleIndex, itemIndex)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs hover:bg-background',
                      selectedModuleIndex === moduleIndex && selectedItemIndex === itemIndex ? 'bg-background font-medium' : ''
                    )}
                  >
                    <span>{item.product_name || `产品 #${itemIndex + 1}`}</span>
                    <span className="text-muted-foreground">{item.tasks.length} 任务</span>
                  </button>
                  {item.tasks.length > 0 ? (
                    <div className="space-y-1 pl-3">
                      {item.tasks.slice(0, 6).map((task, taskIndex) => (
                        <button
                          key={`${task.task_name}-${taskIndex}`}
                          type="button"
                          onClick={() => onSelectTask(moduleIndex, itemIndex, taskIndex)}
                          className="block w-full truncate rounded px-2 py-0.5 text-left text-xs text-muted-foreground hover:bg-background hover:text-foreground"
                        >
                          {task.task_name || `任务 #${taskIndex + 1}`}
                        </button>
                      ))}
                      {item.tasks.length > 6 ? <div className="px-2 text-xs text-muted-foreground">还有 {item.tasks.length - 6} 个任务</div> : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
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
        <span>四级任务</span><span className="text-right text-foreground">{countTasks(modules)}</span>
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
  return (
    <>
      <Input list={listId} {...props} />
      <OptionList id={listId} values={values} />
    </>
  );
}

function OptionList({ id, values }: { id: string; values: readonly string[] }) {
  return (
    <datalist id={id}>
      {values.map((value) => <option key={value} value={value} />)}
    </datalist>
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
