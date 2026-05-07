'use client';

import { useEffect } from 'react';
import { useForm, type FieldValues, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { supplierFormSchema, supplierCategories, supplierRatings, supplierStatuses, type Supplier } from '../schemas';

interface SupplierFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier | null;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  loading?: boolean;
}

const defaultValues = {
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  category: '原材料' as '原材料' | '包装耗材' | '外协加工' | '办公设备',
  rating: 'B' as 'A' | 'B' | 'C' | 'D',
  status: 'active' as 'active' | 'inspecting' | 'blacklisted',
  address: '',
  remark: '',
};

export function SupplierFormModal({ open, onOpenChange, supplier, onSubmit, loading }: SupplierFormModalProps) {
  const isEdit = !!supplier;

  // 不指定泛型参数，让 zodResolver 自动推断类型，避免 zod v4 input/output 类型差异
  const form = useForm({
    resolver: zodResolver(supplierFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (supplier) {
      const catValue = (supplierCategories as readonly string[]).includes(supplier.category || '')
        ? supplier.category as '原材料' | '包装耗材' | '外协加工' | '办公设备'
        : '原材料' as '原材料' | '包装耗材' | '外协加工' | '办公设备';
      const ratingValue = (supplierRatings as readonly string[]).includes(supplier.rating || '')
        ? supplier.rating as 'A' | 'B' | 'C' | 'D'
        : 'B' as 'A' | 'B' | 'C' | 'D';
      const statusValue = ['active', 'inspecting', 'blacklisted'].includes(supplier.status || '')
        ? supplier.status as 'active' | 'inspecting' | 'blacklisted'
        : 'active' as 'active' | 'inspecting' | 'blacklisted';

      form.reset({
        name: supplier.name || '',
        contactPerson: supplier.contact_person ?? '',
        phone: supplier.phone ?? '',
        email: supplier.email ?? '',
        category: catValue,
        rating: ratingValue,
        status: statusValue,
        address: supplier.address ?? '',
        remark: supplier.remark ?? '',
      });
    } else {
      form.reset(defaultValues);
    }
  }, [supplier, form]);

  const handleFormSubmit: SubmitHandler<FieldValues> = (values) => {
    return onSubmit(values as Record<string, unknown>);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑供应商' : '新增供应商'}</DialogTitle>
          <DialogDescription>
            {isEdit ? '修改供应商档案信息' : '录入新的供应商档案信息'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
            {/* 基础信息区 */}
            <div>
              <h4 className="text-sm font-semibold mb-3">基础信息</h4>
              <Separator className="mb-4" />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>供应商名称 <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <Input placeholder="请输入供应商全称" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>供应类别 <span className="text-destructive">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择类别" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {supplierCategories.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>信用评级</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="选择评级" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {supplierRatings.map((r) => (
                            <SelectItem key={r} value={r}>{r}级</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isEdit && (
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>合作状态</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择状态" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {supplierStatuses.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>详细地址</FormLabel>
                      <FormControl>
                        <Input placeholder="请输入详细地址" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 联系方式区 */}
            <div>
              <h4 className="text-sm font-semibold mb-3">联系方式</h4>
              <Separator className="mb-4" />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="contactPerson"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>联系人</FormLabel>
                      <FormControl>
                        <Input placeholder="请输入联系人姓名" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>联系电话</FormLabel>
                      <FormControl>
                        <Input placeholder="手机号或座机号" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>联系邮箱</FormLabel>
                      <FormControl>
                        <Input placeholder="请输入邮箱地址（选填）" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* 备注区 */}
            <div>
              <h4 className="text-sm font-semibold mb-3">其他</h4>
              <Separator className="mb-4" />
              <FormField
                control={form.control}
                name="remark"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>备注</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="备注信息（选填）"
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? '提交中...' : isEdit ? '保存修改' : '创建供应商'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
