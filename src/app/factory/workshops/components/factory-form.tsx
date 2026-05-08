'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { workshopFormSchema, type WorkshopFormValues, type WorkshopStatusType } from '../schemas';
import { Loader2 } from 'lucide-react';

interface FactoryFormProps {
  workshop?: {
    id: string;
    factory_code: string;
    name: string;
    location: string | null;
    manager: string | null;
    capacity: number;
    current_load: number;
    status: WorkshopStatusType;
    description: string | null;
  } | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function FactoryForm({ workshop, onSuccess, onCancel }: FactoryFormProps) {
  const isEditing = !!workshop;

  const form = useForm<WorkshopFormValues>({
    resolver: zodResolver(workshopFormSchema),
    defaultValues: {
      factory_code: workshop?.factory_code ?? '',
      name: workshop?.name ?? '',
      location: workshop?.location ?? '',
      manager: workshop?.manager ?? '',
      capacity: workshop?.capacity ?? 0,
      current_load: workshop?.current_load ?? 0,
      status: workshop?.status ?? 'normal',
      description: workshop?.description ?? '',
    },
  });

  // Reset form when workshop changes
  useEffect(() => {
    form.reset({
      factory_code: workshop?.factory_code ?? '',
      name: workshop?.name ?? '',
      location: workshop?.location ?? '',
      manager: workshop?.manager ?? '',
      capacity: workshop?.capacity ?? 0,
      current_load: workshop?.current_load ?? 0,
      status: workshop?.status ?? 'normal',
      description: workshop?.description ?? '',
    });
  }, [workshop, form]);

  const onSubmit = async (values: WorkshopFormValues) => {
    try {
      const url = isEditing
        ? `/api/factory/workshops/${workshop!.id}`
        : '/api/factory/workshops';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const error = await res.json();
        if (error.error?.includes('factory_code')) {
          form.setError('factory_code', { message: '该编号已存在' });
          return;
        }
        if (error.error?.includes('负荷不能超过产能')) {
          form.setError('current_load', { message: '当前负荷不能超过产能' });
          return;
        }
        throw new Error(error.error || '操作失败');
      }

      onSuccess();
    } catch (err) {
      console.error('Failed to save workshop:', err);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="factory_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>车间编号 <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input
                    placeholder="如: WH-A01"
                    {...field}
                    disabled={isEditing}
                    className="font-mono"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>车间名称 <span className="text-red-500">*</span></FormLabel>
                <FormControl>
                  <Input placeholder="如: 板式车间" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>位置</FormLabel>
                <FormControl>
                  <Input placeholder="如: A栋1楼" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="manager"
            render={({ field }) => (
              <FormItem>
                <FormLabel>负责人</FormLabel>
                <FormControl>
                  <Input placeholder="如: 张伟" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="capacity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>日产能</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="current_load"
            render={({ field }) => (
              <FormItem>
                <FormLabel>当前负荷</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0)}
                  />
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
                <FormLabel>运行状态</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="选择状态" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="normal">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        正常运行
                      </span>
                    </SelectItem>
                    <SelectItem value="maintenance">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        检修中
                      </span>
                    </SelectItem>
                    <SelectItem value="stopped">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                        已停工
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>描述</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="车间用途、设备等简要说明..."
                  className="resize-none h-20"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            {isEditing ? '保存修改' : '创建车间'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
