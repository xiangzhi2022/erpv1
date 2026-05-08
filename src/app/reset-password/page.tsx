'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const t = searchParams.get('token');
    if (!t) {
      toast.error('缺少重置令牌，请从邮件中的链接访问');
      router.push('/forgot-password');
      return;
    }
    setToken(t);
  }, [searchParams, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      toast.error('请输入新密码');
      return;
    }
    if (password.length < 6) {
      toast.error('密码长度不能少于6位');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || '重置失败');
        return;
      }

      setSuccess(true);
      toast.success('密码重置成功');
    } catch {
      toast.error('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center space-y-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-50 mb-4">
            <ShieldCheck className="h-7 w-7 text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">密码重置成功</h1>
          <p className="text-sm text-slate-500">您的密码已成功重置，请使用新密码登录</p>
          <Button
            onClick={() => router.push('/login')}
            className="h-11 w-full rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium"
          >
            前往登录
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        {/* 返回 */}
        <button
          onClick={() => router.push('/login')}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          返回登录
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-100 mb-4">
              <ShieldCheck className="h-7 w-7 text-slate-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">重置密码</h1>
            <p className="mt-2 text-sm text-slate-500">请输入您的新密码</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 新密码 */}
            <div className="space-y-2">
              <Label htmlFor="password">新密码</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="请输入新密码（至少6位）"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-10 rounded-lg border-slate-200 focus:border-slate-400 focus:ring-slate-400"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* 确认密码 */}
            <div className="space-y-2">
              <Label htmlFor="confirm">确认密码</Label>
              <div className="relative">
                <Input
                  id="confirm"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="请再次输入新密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-11 pr-10 rounded-lg border-slate-200 focus:border-slate-400 focus:ring-slate-400"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  重置中...
                </>
              ) : (
                '确认重置'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
