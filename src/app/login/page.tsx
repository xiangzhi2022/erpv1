'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, Smartphone, Mail, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

// ===================== OAuth 图标组件 =====================

function WechatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05a6.127 6.127 0 0 1-.253-1.726c0-3.573 3.26-6.47 7.278-6.47.122 0 .243.005.363.013C15.596 4.373 12.454 2.188 8.691 2.188zm-2.6 4.17a1.03 1.03 0 1 1 0 2.06 1.03 1.03 0 0 1 0-2.06zm5.2 0a1.03 1.03 0 1 1 0 2.06 1.03 1.03 0 0 1 0-2.06zM23.997 15.39c0-3.248-3.238-5.882-7.229-5.882-3.992 0-7.23 2.634-7.23 5.882 0 3.249 3.238 5.882 7.23 5.882.84 0 1.647-.118 2.398-.332a.72.72 0 0 1 .596.08l1.58.926a.27.27 0 0 0 .14.047c.133 0 .24-.11.24-.245 0-.06-.024-.118-.04-.177l-.323-1.229a.49.49 0 0 1 .177-.553c1.52-1.12 2.501-2.768 2.501-4.399zm-9.726-1.08a.857.857 0 1 1 0-1.714.857.857 0 0 1 0 1.714zm4.992 0a.857.857 0 1 1 0-1.714.857.857 0 0 1 0 1.714z" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

// ===================== 纸艺几何装饰组件 =====================

function PaperArtDecoration() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* 大三角形 */}
      <div className="absolute -top-20 -left-20 w-80 h-80 bg-white/[0.06] rotate-12" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
      {/* 圆形 */}
      <div className="absolute top-1/3 right-10 w-40 h-40 border-2 border-white/[0.08] rounded-full" />
      <div className="absolute top-1/2 right-16 w-24 h-24 bg-white/[0.04] rounded-full" />
      {/* 菱形 */}
      <div className="absolute bottom-32 left-16 w-28 h-28 bg-white/[0.05] rotate-45" />
      {/* 小三角形 */}
      <div className="absolute top-20 right-1/3 w-16 h-16 bg-white/[0.08]" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
      {/* 横线 */}
      <div className="absolute bottom-48 left-8 right-8 h-px bg-white/[0.06]" />
      <div className="absolute bottom-52 left-16 right-16 h-px bg-white/[0.04]" />
      {/* 半圆 */}
      <div className="absolute -bottom-16 left-1/3 w-48 h-48 border-2 border-white/[0.06] rounded-t-full" />
      {/* 点状装饰 */}
      <div className="absolute top-16 left-1/2 w-2 h-2 bg-white/[0.12] rounded-full" />
      <div className="absolute top-24 left-[45%] w-1.5 h-1.5 bg-white/[0.08] rounded-full" />
      <div className="absolute top-28 left-[55%] w-1 h-1 bg-white/[0.06] rounded-full" />
    </div>
  );
}

// ===================== 主登录页面 =====================

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 表单状态
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  // 验证码状态
  const [captchaId, setCaptchaId] = useState('');
  const [captchaSvg, setCaptchaSvg] = useState('');

  // 检测账号类型
  const isPhone = /^1\d{10,}$/.test(account);
  const isEmail = /@/.test(account);

  // OAuth 错误处理
  const oauthError = searchParams.get('error');

  useEffect(() => {
    if (oauthError) {
      toast.error(decodeURIComponent(oauthError));
    }
  }, [oauthError]);

  // 加载记住的账号
  useEffect(() => {
    const saved = localStorage.getItem('remembered_account');
    if (saved) {
      setAccount(saved);
      setRememberMe(true);
    }
  }, []);

  // 获取验证码
  const fetchCaptcha = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/captcha');
      const data = await res.json();
      setCaptchaId(data.captchaId);
      setCaptchaSvg(data.svg);
    } catch {
      toast.error('获取验证码失败');
    }
  }, []);

  useEffect(() => {
    fetchCaptcha();
  }, [fetchCaptcha]);

  // 前端校验
  const validate = (): string | null => {
    if (!account.trim()) return '请输入手机号或邮箱';
    if (/^1/.test(account)) {
      if (!/^1[3-9]\d{9}$/.test(account)) return '手机号格式不正确';
    } else if (account.includes('@')) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account)) return '邮箱格式不正确';
    } else {
      return '请输入有效的手机号或邮箱';
    }
    if (!password) return '请输入密码';
    if (password.length < 6) return '密码长度不能少于6位';
    if (!captchaCode.trim()) return '请输入验证码';
    return null;
  };

  // 登录提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: account.trim(),
          password,
          captchaId,
          captchaCode: captchaCode.trim(),
          rememberMe,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || '登录失败');
        fetchCaptcha(); // 刷新验证码
        setCaptchaCode('');
        return;
      }

      // 记住我
      if (rememberMe) {
        localStorage.setItem('remembered_account', account.trim());
      } else {
        localStorage.removeItem('remembered_account');
      }

      toast.success('登录成功，正在跳转...');
      setTimeout(() => router.push('/'), 800);
    } catch {
      toast.error('网络错误，请检查网络连接');
      fetchCaptcha();
      setCaptchaCode('');
    } finally {
      setLoading(false);
    }
  };

  // OAuth 登录
  const handleOAuthLogin = (provider: string) => {
    // 重定向到 OAuth 入口
    window.location.href = `/api/auth/oauth/${provider}?redirect=/`;
  };

  return (
    <div className="flex min-h-screen">
      {/* ===== 左侧品牌面板 ===== */}
      <div className="hidden lg:flex lg:w-[45%] relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex-col items-center justify-center p-12 overflow-hidden">
        <PaperArtDecoration />
        <div className="relative z-10 text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm mb-4">
            <svg viewBox="0 0 24 24" className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">欢迎使用平台</h1>
          <p className="text-slate-300 text-lg max-w-sm leading-relaxed">
            一站式智能解决方案，助您高效管理、轻松协作
          </p>
          <div className="flex items-center justify-center gap-8 pt-4 text-sm text-slate-400">
            <div className="text-center">
              <div className="text-2xl font-semibold text-white">10K+</div>
              <div>活跃用户</div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="text-center">
              <div className="text-2xl font-semibold text-white">99.9%</div>
              <div>服务可用</div>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="text-center">
              <div className="text-2xl font-semibold text-white">24/7</div>
              <div>技术支持</div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 右侧登录表单 ===== */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-white">
        <div className="w-full max-w-md space-y-8">
          {/* 标题 */}
          <div>
            <h2 className="text-2xl font-bold text-slate-900">登录</h2>
            <p className="mt-2 text-sm text-slate-500">请输入您的账号信息以继续</p>
          </div>

          {/* 第三方登录 */}
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-lg border-slate-200 hover:bg-green-50 hover:border-green-200 hover:text-green-600 transition-colors"
                onClick={() => handleOAuthLogin('wechat')}
              >
                <WechatIcon />
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-lg border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                onClick={() => handleOAuthLogin('github')}
              >
                <GithubIcon />
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-lg border-slate-200 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                onClick={() => handleOAuthLogin('google')}
              >
                <GoogleIcon />
              </Button>
            </div>
          </div>

          {/* 分割线 */}
          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs text-slate-400">
              或使用账号密码登录
            </span>
          </div>

          {/* 登录表单 */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 账号输入 */}
            <div className="space-y-2">
              <Label htmlFor="account">手机号 / 邮箱</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {isPhone ? <Smartphone className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                </span>
                <Input
                  id="account"
                  type="text"
                  placeholder="请输入手机号或邮箱"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  className="h-11 pl-10 rounded-lg border-slate-200 focus:border-slate-400 focus:ring-slate-400"
                  autoComplete="username"
                />
              </div>
            </div>

            {/* 密码输入 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">密码</Label>
                <button
                  type="button"
                  onClick={() => router.push('/forgot-password')}
                  className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
                >
                  忘记密码?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-10 rounded-lg border-slate-200 focus:border-slate-400 focus:ring-slate-400"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* 验证码 */}
            <div className="space-y-2">
              <Label htmlFor="captcha">验证码</Label>
              <div className="flex gap-3">
                <Input
                  id="captcha"
                  type="text"
                  placeholder="请输入验证码"
                  value={captchaCode}
                  onChange={(e) => setCaptchaCode(e.target.value)}
                  className="h-11 flex-1 rounded-lg border-slate-200 focus:border-slate-400 focus:ring-slate-400"
                  maxLength={4}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={fetchCaptcha}
                  className="h-11 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors overflow-hidden min-w-[120px]"
                  title="点击刷新验证码"
                >
                  {captchaSvg ? (
                    <span dangerouslySetInnerHTML={{ __html: captchaSvg }} />
                  ) : (
                    <RefreshCw className="h-4 w-4 text-slate-400" />
                  )}
                </button>
              </div>
            </div>

            {/* 记住我 */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
              <Label htmlFor="remember" className="text-sm text-slate-600 cursor-pointer">
                记住我
              </Label>
            </div>

            {/* 提交按钮 */}
            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  登录中...
                </>
              ) : (
                '登录'
              )}
            </Button>
          </form>

          {/* 演示提示 */}
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-4 text-xs text-slate-500 space-y-1">
            <p className="font-medium text-slate-700">演示账号</p>
            <p>邮箱: demo@example.com / 手机: 13800138000</p>
            <p>密码: demo123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
