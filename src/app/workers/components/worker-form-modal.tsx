'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { workerFormSchema, WorkerFormValues, CRAFT_TYPES, GENDERS, WORKER_STATUSES, Worker, safeParseTags } from '../schemas';
import {
  Dialog,
  DialogContent,
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

interface WorkerFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editWorker: Worker | null;
  onSuccess: () => void;
}

function getDefaultValues(editWorker: Worker | null): WorkerFormValues {
  if (editWorker) {
    return {
      worker_no: editWorker.worker_no || '',
      name: editWorker.name,
      phone: editWorker.phone || '',
      gender: editWorker.gender || '',
      craft_type: editWorker.craft_type || '',
      workshop_id: editWorker.workshop_id || '',
      status: (editWorker.status === 'active' || editWorker.status === 'on_leave' || editWorker.status === 'resigned')
        ? editWorker.status
        : 'active',
      skill_tags: safeParseTags(editWorker.skill_tags).join(','),
      hire_date: editWorker.hire_date ? editWorker.hire_date.split('T')[0] : '',
      remark: editWorker.remark || '',
    };
  }
  return {
    worker_no: '',
    name: '',
    phone: '',
    gender: '',
    craft_type: '',
    workshop_id: '',
    status: 'active',
    skill_tags: '',
    hire_date: '',
    remark: '',
  };
}

export function WorkerFormModal({ open, onOpenChange, editWorker, onSuccess }: WorkerFormModalProps) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<WorkerFormValues>({
    resolver: zodResolver(workerFormSchema),
    defaultValues: getDefaultValues(editWorker),
  });

  // 当编辑工人变化或弹窗打开时重置表单
  useEffect(() => {
    if (open) {
      form.reset(getDefaultValues(editWorker));
    }
  }, [open, editWorker, form]);

  const onSubmit = async (values: WorkerFormValues) => {
    try {
      setSubmitting(true);
      const payload = {
        ...values,
        skill_tags: values.skill_tags
          ? JSON.stringify(values.skill_tags.split(',').map(t => t.trim()).filter(Boolean))
          : null,
        // 将空字符串转为 null，与数据库 nullable 字段一致
        phone: values.phone || null,
        gender: values.gender || null,
        craft_type: values.craft_type || null,
        workshop_id: values.workshop_id || null,
        hire_date: values.hire_date || null,
        remark: values.remark || null,
      };

      const url = editWorker ? `/api/workers/${editWorker.id}` : '/api/workers';
      const method = editWorker ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(editWorker ? '更新成功' : '创建成功');
        onSuccess();
      } else {
        toast.error(data.error || '操作失败');
      }
    } catch {
      toast.error('网络错误');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editWorker ? '编辑工人' : '新增工人'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>姓名 *</FormLabel>
                    <FormControl><Input {...field} placeholder="请输入姓名" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="worker_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>工号</FormLabel>
                    <FormControl><Input {...field} placeholder="留空自动生成" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>手机号</FormLabel>
                    <FormControl><Input {...field} placeholder="请输入手机号" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>性别</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {GENDERS.map((g) => (
                          <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="craft_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>工种</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {CRAFT_TYPES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {WORKER_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="skill_tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>技能标签</FormLabel>
                  <FormControl><Input {...field} placeholder="多个标签用逗号分隔，如：熟练工,组长" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hire_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>入职日期</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
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
                  <FormControl><Textarea {...field} placeholder="备注信息" rows={3} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? '提交中...' : editWorker ? '保存' : '创建'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
