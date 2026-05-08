'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error('请输入邮箱地址');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('邮箱格式不正确');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || '发送失败');
        return;
      }

      setSent(true);
      if (data.devResetUrl) {
        setDevResetUrl(data.devResetUrl);
      }
      toast.success(data.message || '重置邮件已发送');
    } catch {
      toast.error('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        {/* 返回登录 */}
        <button
          onClick={() => router.push('/login')}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          返回登录
        </button>

        {!sent ? (
          /* ===== 未发送状态 ===== */
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 mb-4">
                <Mail className="h-7 w-7 text-slate-600" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">忘记密码</h1>
              <p className="mt-2 text-sm text-slate-500">
                请输入注册时使用的邮箱地址，我们将发送密码重置链接
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">邮箱地址</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="请输入邮箱"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-lg border-slate-200 focus:border-slate-400 focus:ring-slate-400"
                  autoComplete="email"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    发送中...
                  </>
                ) : (
                  '发送重置链接'
                )}
              </Button>
            </form>
          </div>
        ) : (
          /* ===== 已发送状态 ===== */
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-50 mb-4">
                <Mail className="h-7 w-7 text-green-600" />
              </div>
              <h1 className="text-xl font-bold text-slate-900">邮件已发送</h1>
              <p className="mt-2 text-sm text-slate-500">
                我们已向 <span className="font-medium text-slate-700">{email}</span> 发送了密码重置链接，请查收邮件
              </p>
              <p className="mt-1 text-xs text-slate-400">链接 30 分钟内有效</p>
            </div>

            {/* 开发模式：显示重置链接 */}
            {devResetUrl && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 space-y-2">
                <p className="text-xs font-medium text-amber-800">开发模式 - 直接访问重置链接</p>
                <a
                  href={devResetUrl}
                  className="text-xs text-amber-700 underline break-all hover:text-amber-900"
                >
                  {devResetUrl}
                </a>
              </div>
            )}

            <div className="space-y-3">
              <Button
                onClick={() => {
                  setSent(false);
                  setEmail('');
                  setDevResetUrl('');
                }}
                variant="outline"
                className="h-11 w-full rounded-lg border-slate-200"
              >
                重新发送
              </Button>
              <Button
                onClick={() => router.push('/login')}
                className="h-11 w-full rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium"
              >
                返回登录
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
