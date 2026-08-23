'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiErrorMessage } from '@/lib/api/client-error';

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [joinForm, setJoinForm] = useState({ enterpriseId: '', message: '' });
  const [joinSubmitted, setJoinSubmitted] = useState(false);
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

  async function requestJoin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/organization-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enterprise_id: joinForm.enterpriseId, message: joinForm.message || null }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(getApiErrorMessage(payload, '提交加入申请失败'));
        return;
      }
      setJoinSubmitted(true);
      toast.success('加入申请已提交，请等待企业管理员审批');
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
        <h1 className="mt-5 text-2xl font-semibold text-slate-950">企业设置</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          身份已验证。你可以创建新企业，或申请加入已有企业。
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <Button type="button" variant={mode === 'create' ? 'default' : 'ghost'} onClick={() => setMode('create')}>创建企业</Button>
          <Button type="button" variant={mode === 'join' ? 'default' : 'ghost'} onClick={() => setMode('join')}>加入企业</Button>
        </div>

        {mode === 'create' ? <form onSubmit={submit} className="mt-7 space-y-5">
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
        </form> : (
          <form onSubmit={requestJoin} className="mt-7 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="enterprise-id">企业 ID</Label>
              <Input
                id="enterprise-id"
                value={joinForm.enterpriseId}
                onChange={(event) => setJoinForm((value) => ({ ...value, enterpriseId: event.target.value }))}
                placeholder="向企业管理员获取企业 ID"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="join-message">申请说明</Label>
              <Input
                id="join-message"
                value={joinForm.message}
                onChange={(event) => setJoinForm((value) => ({ ...value, message: event.target.value }))}
                maxLength={500}
                placeholder="姓名、部门或岗位说明（选填）"
              />
            </div>
            <Button type="submit" disabled={loading || joinSubmitted} className="h-11 w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {joinSubmitted ? '申请已提交，等待审批' : '提交加入申请'}
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}
