'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Loader2, ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { orderFormSchema, OrderFormValues, Customer } from '../schemas';

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateOrderDialog({ open, onOpenChange, onSuccess }: CreateOrderDialogProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [generatingOrderNo, setGeneratingOrderNo] = useState(false);

  // Type-safe form with Zod validation
  // z.coerce transforms input types, so we cast resolver to match form types
  const form = useForm<OrderFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(orderFormSchema) as any,
    defaultValues: {
      order_no: '',
      customer_name: '',
      delivery_date: '',
      remark: '',
      items: [{ product_name: '', specification: '', quantity: 1, unit: '件', unit_price: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const items = form.watch('items');

  // Calculate total amount
  const totalAmount = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    return sum + qty * price;
  }, 0);

  // Fetch customers
  const fetchCustomers = useCallback(async (search?: string) => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await fetch(`/api/customers?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.data || []);
      }
    } catch (err) {
      console.error('Fetch customers failed:', err);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchCustomers();
    }
  }, [open, fetchCustomers]);

  // Generate order number
  const generateOrderNo = async () => {
    setGeneratingOrderNo(true);
    try {
      const res = await fetch('/api/orders/generate', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        form.setValue('order_no', data.orderNo);
      } else {
        // Fallback: use sequence API
        const seqRes = await fetch('/api/orders/sequence');
        const seqData = await seqRes.json();
        if (seqData.success) {
          form.setValue('order_no', seqData.orderNo);
        }
      }
    } catch {
      // Last fallback
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const rand = Math.floor(Math.random() * 100).toString().padStart(2, '0');
      form.setValue('order_no', `QYD${dateStr}${rand}`);
    } finally {
      setGeneratingOrderNo(false);
    }
  };

  // Auto-generate order number on open
  useEffect(() => {
    if (open && !form.getValues('order_no')) {
      generateOrderNo();
    }
  }, [open]);

  // Select customer
  const selectCustomer = (customer: Customer) => {
    form.setValue('customer_name', customer.name);
    setCustomerSearchOpen(false);
    setCustomerSearch('');
  };

  // Submit
  const onSubmit = async (values: OrderFormValues) => {
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        items: values.items.map((item) => ({
          ...item,
          unit_price: Math.round(Number(item.unit_price) * 100), // Convert to cents
        })),
        total_amount: Math.round(totalAmount * 100),
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        form.reset();
        onSuccess();
        onOpenChange(false);
      } else {
        alert(data.error || '创建失败');
      }
    } catch {
      alert('创建订单失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="text-lg">创建订单</DialogTitle>
          <DialogDescription>填写订单信息并添加产品明细</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-140px)]">
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">基本信息</h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Order No */}
                <div className="space-y-2">
                  <Label>订单编号 *</Label>
                  <div className="flex gap-2">
                    <Input
                      {...form.register('order_no')}
                      placeholder="订单编号"
                      className="font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={generateOrderNo}
                      disabled={generatingOrderNo}
                    >
                      {generatingOrderNo ? <Loader2 className="h-4 w-4 animate-spin" /> : '🔄'}
                    </Button>
                  </div>
                  {form.formState.errors.order_no && (
                    <p className="text-xs text-destructive">{form.formState.errors.order_no.message}</p>
                  )}
                </div>

                {/* Customer Select */}
                <div className="space-y-2">
                  <Label>客户名称 *</Label>
                  <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={customerSearchOpen}
                        className="w-full justify-between font-normal"
                      >
                        {form.watch('customer_name') || '选择客户...'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="搜索客户..."
                          value={customerSearch}
                          onValueChange={(v) => {
                            setCustomerSearch(v);
                            fetchCustomers(v);
                          }}
                        />
                        <CommandList>
                          <CommandEmpty>未找到客户</CommandEmpty>
                          <CommandGroup>
                            {customers.map((customer) => (
                              <CommandItem
                                key={customer.id}
                                value={customer.id}
                                onSelect={() => selectCustomer(customer)}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    form.watch('customer_name') === customer.name ? 'opacity-100' : 'opacity-0'
                                  )}
                                />
                                <div>
                                  <p className="font-medium">{customer.name}</p>
                                  {customer.phone && (
                                    <p className="text-xs text-muted-foreground">{customer.phone}</p>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {form.formState.errors.customer_name && (
                    <p className="text-xs text-destructive">{form.formState.errors.customer_name.message}</p>
                  )}
                </div>

                {/* Delivery Date */}
                <div className="space-y-2">
                  <Label>交付日期</Label>
                  <Input
                    type="date"
                    {...form.register('delivery_date')}
                  />
                </div>

                {/* Remark */}
                <div className="space-y-2">
                  <Label>备注</Label>
                  <Input
                    {...form.register('remark')}
                    placeholder="订单备注（选填）"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Order Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">产品明细</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ product_name: '', specification: '', quantity: 1, unit: '件', unit_price: 0 })}
                  className="gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> 添加产品
                </Button>
              </div>

              {form.formState.errors.items && !form.formState.errors.items?.root && (
                <p className="text-xs text-destructive">{form.formState.errors.items.message}</p>
              )}
              {form.formState.errors.items?.root && (
                <p className="text-xs text-destructive">{form.formState.errors.items.root.message}</p>
              )}

              <div className="space-y-3">
                {fields.map((field, index) => {
                  const itemErrors = form.formState.errors.items?.[index];
                  const subtotal = (Number(items[index]?.quantity) || 0) * (Number(items[index]?.unit_price) || 0);
                  return (
                    <div key={field.id} className="p-4 border rounded-lg bg-muted/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">产品 #{index + 1}</span>
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-5 gap-3">
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">产品名称 *</Label>
                          <Input
                            {...form.register(`items.${index}.product_name`)}
                            placeholder="产品名称"
                            className="h-9"
                          />
                          {itemErrors?.product_name && (
                            <p className="text-xs text-destructive">{itemErrors.product_name.message}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">规格</Label>
                          <Input
                            {...form.register(`items.${index}.specification`)}
                            placeholder="规格"
                            className="h-9"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">数量 *</Label>
                          <Input
                            type="number"
                            min={1}
                            {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
                            className="h-9"
                          />
                          {itemErrors?.quantity && (
                            <p className="text-xs text-destructive">{itemErrors.quantity.message}</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">单位</Label>
                          <Controller
                            control={form.control}
                            name={`items.${index}.unit`}
                            render={({ field: unitField }) => (
                              <Select value={unitField.value} onValueChange={unitField.onChange}>
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="件">件</SelectItem>
                                  <SelectItem value="套">套</SelectItem>
                                  <SelectItem value="米">米</SelectItem>
                                  <SelectItem value="平方米">平方米</SelectItem>
                                  <SelectItem value="块">块</SelectItem>
                                  <SelectItem value="个">个</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-5 gap-3">
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">单价（元）*</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            {...form.register(`items.${index}.unit_price`, { valueAsNumber: true })}
                            placeholder="0.00"
                            className="h-9 font-mono"
                          />
                          {itemErrors?.unit_price && (
                            <p className="text-xs text-destructive">{itemErrors.unit_price.message}</p>
                          )}
                        </div>
                        <div className="col-span-2 flex items-end">
                          <div className="text-sm text-muted-foreground">
                            小计：<span className="font-mono font-semibold text-foreground">¥{subtotal.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Total */}
              <div className="flex justify-end pt-2">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">订单总金额</p>
                  <p className="text-2xl font-bold font-mono">¥{totalAmount.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </form>
        </ScrollArea>

        <DialogFooter className="p-6 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={submitting} className="gap-2 min-w-[100px]">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? '提交中...' : '创建订单'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
