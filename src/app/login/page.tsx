'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type AuthMode = 'login' | 'register';

const DEFAULT_REDIRECT_PATH = '/orders';

interface LoginResponse {
  success?: boolean;
  error?: string;
  error_code?: string;
  redirectTo?: string;
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>(searchParams.get('mode') === 'register' ? 'register' : 'login');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [registerForm, setRegisterForm] = useState({
    phone: '',
    companyName: '',
    tenantType: 'manufacturer',
    contactPerson: '',
    address: '',
    prefix: '',
    password: '',
    confirmPassword: '',
  });
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [pendingPhone, setPendingPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  const oauthError = searchParams.get('error');
  const isPhone = /^1\d{10,}$/.test(account);

  useEffect(() => {
    if (oauthError) {
      toast.error(decodeURIComponent(oauthError));
    }
  }, [oauthError]);

  useEffect(() => {
    const saved = localStorage.getItem('remembered_account');
    if (saved) {
      setAccount(saved);
      setRememberMe(true);
    }
  }, []);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setLoginError('');
    const target = nextMode === 'register' ? '/login?mode=register' : '/login';
    router.replace(target, { scroll: false });
  };

  const validateLogin = () => {
    if (!account.trim()) return '请输入手机号或邮箱';
    if (/^1/.test(account) && !/^1[3-9]\d{9}$/.test(account)) return '手机号格式不正确';
    if (account.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account)) return '邮箱格式不正确';
    if (!/^1/.test(account) && !account.includes('@')) return '请输入有效的手机号或邮箱';
    if (!password) return '请输入密码';
    if (password.length < 8) return '密码长度不能少于 8 位';
    return null;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateLogin();
    if (error) {
      setLoginError(error);
      toast.error(error);
      return;
    }

    setLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: account.trim(),
          password,
        }),
      });
      const data = await res.json() as LoginResponse;

      if (!res.ok || !data.success) {
        const message = data.error || '登录失败';
        setLoginError(message);
        toast.error(message);
        return;
      }

      if (rememberMe) {
        localStorage.setItem('remembered_account', account.trim());
      } else {
        localStorage.removeItem('remembered_account');
      }

      const redirectTo = typeof data.redirectTo === 'string' ? data.redirectTo : DEFAULT_REDIRECT_PATH;
      toast.success('登录成功，正在进入工作台...');
      router.replace(redirectTo);
    } catch {
      const message = '网络错误，请检查网络连接';
      setLoginError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const validateRegister = () => {
    if (!/^1[3-9]\d{9}$/.test(registerForm.phone)) return '请输入正确的 11 位手机号';
    if (!registerForm.companyName.trim()) return '请输入企业名称';
    if (!registerForm.contactPerson.trim()) return '请输入管理员姓名';
    if (registerForm.password.length < 8) return '密码至少 8 位';
    if (registerForm.password !== registerForm.confirmPassword) return '两次输入的密码不一致';
    return null;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateRegister();
    if (error) {
      toast.error(error);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: registerForm.phone,
          password: registerForm.password,
          companyName: registerForm.companyName.trim(),
          tenantType: registerForm.tenantType,
          contactPerson: registerForm.contactPerson.trim(),
          address: registerForm.address.trim(),
          prefix: registerForm.prefix.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error(data.error || '注册失败');
        return;
      }

      toast.success(data.message || '注册申请已提交');
      if (data.requiresVerification) {
        setPendingPhone(registerForm.phone);
        return;
      }
      setAccount(registerForm.phone);
      setPassword('');
      switchMode('login');
    } catch {
      toast.error('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhone = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(verificationCode)) {
      toast.error('请输入 6 位短信验证码');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/auth/sms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: pendingPhone, code: verificationCode }),
      });
      const payload = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) {
        toast.error(payload.error || '验证失败');
        return;
      }
      toast.success('手机号验证成功');
      router.replace('/onboarding');
      router.refresh();
    } catch {
      toast.error('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = (provider: string) => {
    window.location.href = `/api/auth/oauth/${provider}?redirect=${encodeURIComponent(DEFAULT_REDIRECT_PATH)}`;
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#f4efe6] text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden overflow-hidden bg-[#18251f] px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(235,190,109,0.28),transparent_30%),radial-gradient(circle_at_80%_12%,rgba(96,165,250,0.18),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_40%)]" />
          <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full border border-white/15" />
          <div className="absolute bottom-20 right-24 h-32 w-32 rotate-12 rounded-[2rem] border border-amber-200/20" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-amber-100 backdrop-blur">
              <Sparkles className="h-4 w-4" />
              青崖 ERP 工作台
            </div>
            <div className="mt-14 max-w-xl space-y-6">
              <h1 className="text-5xl font-semibold leading-tight tracking-tight">
                从登录开始，
                <br />
                进入对应工作台。
              </h1>
              <p className="text-lg leading-8 text-slate-200">
                登录和注册已经整合到一个入口，减少跳转，让订单、生产、工厂和经销商数据更快进入工作视野。
              </p>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-4">
            {[
              ['订单', '实时状态'],
              ['生产', '进度上报'],
              ['看台', '统一入口'],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-2xl font-semibold text-amber-100">{title}</div>
                <div className="mt-1 text-sm text-slate-300">{desc}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-8 sm:px-8">
          <div className="w-full max-w-[460px]">
            <div className="mb-7 flex rounded-full bg-white p-1 shadow-sm ring-1 ring-black/5">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`flex-1 rounded-full px-4 py-2.5 text-sm font-medium transition ${
                  mode === 'login' ? 'bg-slate-950 text-white shadow' : 'text-slate-500 hover:text-slate-950'
                }`}
              >
                登录
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={`flex-1 rounded-full px-4 py-2.5 text-sm font-medium transition ${
                  mode === 'register' ? 'bg-slate-950 text-white shadow' : 'text-slate-500 hover:text-slate-950'
                }`}
              >
                注册
              </button>
            </div>

            <div className="rounded-[2rem] bg-white p-6 shadow-2xl shadow-slate-900/10 ring-1 ring-black/5 sm:p-8">
              <div className="mb-7">
                <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  {mode === 'login' ? <ShieldCheck className="h-6 w-6" /> : <Building2 className="h-6 w-6" />}
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  {mode === 'login' ? '欢迎回来' : '创建新账号'}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {mode === 'login' ? '登录后将按账号权限进入对应页面。' : '注册完成后回到登录页继续进入系统。'}
                </p>
              </div>

              {mode === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => handleOAuthLogin('github')}>
                      <GithubIcon />
                    </Button>
                    <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => handleOAuthLogin('google')}>
                      <GoogleIcon />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="account">手机号 / 邮箱</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        {isPhone ? <Phone className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                      </span>
                      <Input
                        id="account"
                        value={account}
                        onChange={(event) => {
                          setAccount(event.target.value);
                          setLoginError('');
                        }}
                        placeholder="请输入手机号或邮箱"
                        autoComplete="username"
                        className="h-11 rounded-xl pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">密码</Label>
                      <button type="button" onClick={() => router.push('/forgot-password')} className="text-xs text-slate-500 hover:text-slate-900">
                        忘记密码?
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => {
                          setPassword(event.target.value);
                          setLoginError('');
                        }}
                        placeholder="请输入密码"
                        autoComplete="current-password"
                        className="h-11 rounded-xl pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox id="remember" checked={rememberMe} onCheckedChange={(checked) => setRememberMe(checked === true)} />
                    <Label htmlFor="remember" className="cursor-pointer text-sm text-slate-600">
                      记住账号
                    </Label>
                  </div>

                  {loginError ? (
                    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {loginError}
                    </div>
                  ) : null}

                  <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl bg-slate-950 text-white hover:bg-slate-800">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                    登录并进入系统
                  </Button>
                </form>
              ) : pendingPhone ? (
                <form onSubmit={handleVerifyPhone} className="space-y-5">
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    验证码已发送至 {pendingPhone}，验证后继续初始化企业。
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone-verification-code">短信验证码</Label>
                    <Input
                      id="phone-verification-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={verificationCode}
                      onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6 位验证码"
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl bg-slate-950 text-white hover:bg-slate-800">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    验证并继续
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full rounded-xl"
                    onClick={() => {
                      setPendingPhone('');
                      setVerificationCode('');
                    }}
                  >
                    返回修改注册信息
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="register-phone">手机号</Label>
                    <Input
                      id="register-phone"
                      value={registerForm.phone}
                      onChange={(event) => setRegisterForm((form) => ({ ...form, phone: event.target.value.replace(/\D/g, '').slice(0, 11) }))}
                      placeholder="请输入 11 位手机号"
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="register-company">企业名称</Label>
                      <Input
                        id="register-company"
                        value={registerForm.companyName}
                        onChange={(event) => setRegisterForm((form) => ({ ...form, companyName: event.target.value }))}
                        placeholder="请输入企业名称"
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-tenant-type">企业类型</Label>
                      <select
                        id="register-tenant-type"
                        value={registerForm.tenantType}
                        onChange={(event) => setRegisterForm((form) => ({ ...form, tenantType: event.target.value }))}
                        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                      >
                        <option value="manufacturer">工厂企业</option>
                        <option value="dealer">经销商</option>
                        <option value="material_supplier">供应商</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="register-contact">管理员姓名</Label>
                      <Input
                        id="register-contact"
                        value={registerForm.contactPerson}
                        onChange={(event) => setRegisterForm((form) => ({ ...form, contactPerson: event.target.value }))}
                        placeholder="请输入管理员姓名"
                        className="h-11 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-prefix">订单前缀</Label>
                      <Input
                        id="register-prefix"
                        value={registerForm.prefix}
                        onChange={(event) => setRegisterForm((form) => ({ ...form, prefix: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) }))}
                        placeholder="如 FAC01"
                        className="h-11 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-address">企业地址</Label>
                    <Input
                      id="register-address"
                      value={registerForm.address}
                      onChange={(event) => setRegisterForm((form) => ({ ...form, address: event.target.value }))}
                      placeholder="请输入企业地址"
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">密码</Label>
                    <div className="relative">
                      <Input
                        id="register-password"
                        type={showRegisterPassword ? 'text' : 'password'}
                        value={registerForm.password}
                        onChange={(event) => setRegisterForm((form) => ({ ...form, password: event.target.value }))}
                        placeholder="至少 8 位"
                        className="h-11 rounded-xl pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegisterPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      >
                        {showRegisterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-confirm">确认密码</Label>
                    <Input
                      id="register-confirm"
                      type="password"
                      value={registerForm.confirmPassword}
                      onChange={(event) => setRegisterForm((form) => ({ ...form, confirmPassword: event.target.value }))}
                      placeholder="请再次输入密码"
                      className="h-11 rounded-xl"
                    />
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                    <CheckCircle2 className="mr-2 inline h-4 w-4" />
                    如需验证手机号，请按提示完成验证后再登录。
                  </div>

                  <Button type="submit" disabled={loading} className="h-11 w-full rounded-xl bg-slate-950 text-white hover:bg-slate-800">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                    创建账号
                  </Button>
                </form>
              )}

            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={(
        <main
          role="status"
          aria-label="登录页面加载中"
          className="flex min-h-screen items-center justify-center bg-[#f4efe6] text-slate-600"
        >
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        </main>
      )}
    >
      <LoginPageContent />
    </Suspense>
  );
}
