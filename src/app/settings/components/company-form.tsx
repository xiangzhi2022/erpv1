'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { companySchema, type CompanyFormValues } from '../schemas';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface PrefixInfo {
  prefix: string;
  company_name: string;
  phone: string;
  address: string;
}

export function CompanyForm() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [prefixes, setPrefixes] = useState<PrefixInfo[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ available: boolean; message: string } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [initialValues, setInitialValues] = useState<CompanyFormValues | null>(null);

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      prefix: '',
      companyName: '',
      companyPhone: '',
      companyAddress: '',
    },
  });

  const watchedValues = form.watch();

  useEffect(() => {
    if (!initialValues) return;
    const changed =
      watchedValues.prefix !== initialValues.prefix ||
      watchedValues.companyName !== initialValues.companyName ||
      watchedValues.companyPhone !== initialValues.companyPhone ||
      watchedValues.companyAddress !== initialValues.companyAddress;
    setHasUnsavedChanges(changed);
  }, [watchedValues, initialValues]);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings/load');
      const data = await response.json();
      if (data.success) {
        const formValues = {
          prefix: data.settings?.order_prefix || '',
          companyName: data.settings?.company_name || '',
          companyPhone: data.settings?.company_phone || '',
          companyAddress: data.settings?.company_address || '',
        };
        form.reset(formValues);
        setInitialValues(formValues);
        if (data.isAdmin !== undefined) setIsAdmin(data.isAdmin);
        if (data.prefixes) setPrefixes(data.prefixes);
      }
    } catch (error) {
      console.error('加载设置失败:', error);
      toast.error('加载设置失败');
    } finally {
      setIsLoading(false);
    }
  }, [form]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleVerifyPrefix = async () => {
    const prefix = form.getValues('prefix');
    if (!prefix.trim()) {
      setVerifyResult({ available: false, message: '请输入前缀' });
      return;
    }

    setIsVerifying(true);
    setVerifyResult(null);

    try {
      const response = await fetch(`/api/settings/verify-prefix?prefix=${encodeURIComponent(prefix)}`);
      const data = await response.json();

      if (data.success) {
        setVerifyResult({
          available: data.available,
          message: data.message,
        });
      } else {
        setVerifyResult({ available: false, message: data.error || '验证失败' });
      }
    } catch {
      setVerifyResult({ available: false, message: '验证请求失败' });
    } finally {
      setIsVerifying(false);
    }
  };

  const onSubmit = async (values: CompanyFormValues) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/settings/verify-prefix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefix: values.prefix,
          companyName: values.companyName,
          phone: values.companyPhone,
          address: values.companyAddress,
        }),
      });
      const data = await response.json();

      if (data.success) {
        toast.success('设置保存成功');
        setInitialValues(values);
        setHasUnsavedChanges(false);
        // 重新加载前缀列表
        const loadResponse = await fetch('/api/settings/load');
        const loadData = await loadResponse.json();
        if (loadData.prefixes) setPrefixes(loadData.prefixes);
      } else {
        toast.error(data.error || '保存失败');
      }
    } catch {
      toast.error('保存请求失败');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>公司信息</CardTitle>
        <CardDescription>管理系统基本信息和订单前缀配置</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="prefix"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>订单前缀</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="如: QYD、ORD"
                          className="font-mono"
                          onChange={(e) => {
                            field.onChange(e.target.value.toUpperCase());
                            setVerifyResult(null);
                          }}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleVerifyPrefix}
                        disabled={isVerifying}
                        className="whitespace-nowrap"
                      >
                        {isVerifying ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          '验证可用'
                        )}
                      </Button>
                    </div>
                    {verifyResult && (
                      <div className={`flex items-center gap-2 text-sm ${verifyResult.available ? 'text-green-600' : 'text-red-600'}`}>
                        {verifyResult.available ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                        {verifyResult.message}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">格式: 前缀 + 日期(YYYYMMDD) + 序号(01起)</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>公司名称</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入公司名称" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="companyPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>联系电话</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入联系电话" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="companyAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>公司地址</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入公司地址" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {prefixes.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-3">已有前缀配置</h4>
                  <div className="grid gap-2">
                    {prefixes.map((p, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm p-2 rounded bg-muted/50">
                        <span className="font-mono font-medium">{p.prefix}</span>
                        <span className="text-muted-foreground">-</span>
                        <span>{p.company_name || '未命名'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator />

            <div className="flex justify-between items-center">
              {hasUnsavedChanges ? (
                <span className="text-sm text-amber-600">您有未保存的更改</span>
              ) : !isAdmin ? (
                <span className="text-sm text-muted-foreground">只有管理员可以修改订单前缀配置</span>
              ) : <span />}
              <div className="ml-auto flex gap-2">
                {hasUnsavedChanges && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (initialValues) {
                        form.reset(initialValues);
                        setHasUnsavedChanges(false);
                        setVerifyResult(null);
                      }
                    }}
                  >
                    撤销更改
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={isSaving || (isAdmin && !verifyResult?.available)}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      保存中...
                    </>
                  ) : (
                    '保存设置'
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
