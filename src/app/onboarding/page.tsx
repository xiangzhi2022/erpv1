'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    displayName: '',
    enterpriseName: '',
    enterpriseType: 'manufacturer',
  });

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) {
        toast.error(payload.error || '初始化企业失败');
        return;
      }
      toast.success('企业已创建');
      router.replace('/orders');
      router.refresh();
    } catch {
      toast.error('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
      <section className="w-full max-w-lg rounded-3xl border bg-white p-7 shadow-sm sm:p-9">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
          <Building2 className="h-6 w-6" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-slate-950">初始化企业</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          身份已验证。请完成企业信息，系统将一次性创建企业、管理员成员资格和标准权限。
        </p>

        <form onSubmit={submit} className="mt-7 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="display-name">管理员姓名</Label>
            <Input
              id="display-name"
              value={form.displayName}
              onChange={(event) => setForm((value) => ({ ...value, displayName: event.target.value }))}
              autoComplete="name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="enterprise-name">企业名称</Label>
            <Input
              id="enterprise-name"
              value={form.enterpriseName}
              onChange={(event) => setForm((value) => ({ ...value, enterpriseName: event.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="enterprise-type">企业类型</Label>
            <select
              id="enterprise-type"
              value={form.enterpriseType}
              onChange={(event) => setForm((value) => ({ ...value, enterpriseType: event.target.value }))}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="manufacturer">生产厂家</option>
              <option value="dealer">经销商</option>
              <option value="supplier">供应商</option>
            </select>
          </div>
          <Button type="submit" disabled={loading} className="h-11 w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            创建并进入系统
          </Button>
        </form>
      </section>
    </main>
  );
}
