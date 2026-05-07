'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { dealerFormSchema, type DealerFormValues, type Dealer } from '../schemas';

interface DealerFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingDealer: Dealer | null;
  onSuccess: () => void;
}

export function DealerFormModal({ open, onOpenChange, editingDealer, onSuccess }: DealerFormModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const isEditing = !!editingDealer;

  const form = useForm<DealerFormValues>({
    resolver: zodResolver(dealerFormSchema),
    defaultValues: {
      name: editingDealer?.name || '',
      contactName: editingDealer?.contact_name || '',
      phone: editingDealer?.phone || '',
      region: editingDealer?.region || '',
      status: (editingDealer?.status as 'active' | 'inactive') || 'active',
      remark: editingDealer?.remark || '',
    },
  });

  // 每次弹窗打开时重置表单
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      form.reset({
        name: editingDealer?.name || '',
        contactName: editingDealer?.contact_name || '',
        phone: editingDealer?.phone || '',
        region: editingDealer?.region || '',
        status: (editingDealer?.status as 'active' | 'inactive') || 'active',
        remark: editingDealer?.remark || '',
      });
    }
    onOpenChange(newOpen);
  };

  const onSubmit = async (values: DealerFormValues) => {
    try {
      setSubmitting(true);
      const url = isEditing ? `/api/dealer/${editingDealer.id}` : '/api/dealer';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const result = await res.json();
      if (result.success) {
        toast.success(isEditing ? '编辑成功' : '新增成功');
        onOpenChange(false);
        form.reset();
        onSuccess();
      } else {
        toast.error(result.error || '操作失败');
      }
    } catch {
      toast.error('网络错误，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? '编辑经销商' : '新增经销商'}</DialogTitle>
          <DialogDescription>
            {isEditing ? '修改经销商信息' : '填写经销商基本信息'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>经销商名称 <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="请输入经销商名称" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>联系人</FormLabel>
                    <FormControl>
                      <Input placeholder="联系人姓名" {...field} />
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
                      <Input placeholder="手机号码" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="region"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>所在地区</FormLabel>
                  <FormControl>
                    <Input placeholder="如：浙江省温州市" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>状态</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择状态" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">启用</SelectItem>
                      <SelectItem value="inactive">停用</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="remark"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>备注</FormLabel>
                  <FormControl>
                    <Textarea placeholder="备注信息" className="resize-none" rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                取消
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? '提交中...' : isEditing ? '保存' : '新增'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
