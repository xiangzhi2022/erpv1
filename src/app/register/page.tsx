'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Zap, Eye, EyeOff, ArrowLeft, Check, X, Smartphone, Mail } from 'lucide-react';

function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: { x: number; y: number; vx: number; vy: number; size: number; opacity: number }[] = [];
    const particleCount = 80;

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 1,
        opacity: Math.random() * 0.5 + 0.2,
      });
    }

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(10, 130, 223, ${p.opacity})`;
        ctx.fill();

        particles.slice(i + 1).forEach((p2) => {
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 150) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(10, 130, 223, ${0.1 * (1 - dist / 150)})`;
            ctx.stroke();
          }
        });
      });

      requestAnimationFrame(animate);
    }

    animate();

    const handleResize = () => {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 -z-10" />;
}

function GridBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#001a3d] via-[#002b5c] to-[#001a3d]" />
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(10, 130, 223, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(10, 130, 223, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#0A82DF]/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#91CD30]/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#004DA7]/10 rounded-full blur-3xl" />
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    phone: '',
    password: '',
    confirmPassword: '',
    code: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [codeSending, setCodeSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [codeSent, setCodeSent] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const passwordRequirements = [
    { met: formData.password.length >= 8, text: '至少8个字符' },
    { met: /[A-Z]/.test(formData.password), text: '包含大写字母' },
    { met: /[a-z]/.test(formData.password), text: '包含小写字母' },
    { met: /[0-9]/.test(formData.password), text: '包含数字' },
  ];

  const handleSendCode = async () => {
    if (!formData.phone || formData.phone.length !== 11) {
      alert('请输入正确的11位手机号');
      return;
    }

    setCodeSending(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setCodeSending(false);
    setCodeSent(true);
    setCountdown(60);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!codeSent || !formData.code) {
      alert('请先获取验证码');
      return;
    }

    if (formData.code.length !== 6) {
      alert('请输入6位验证码');
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      alert('两次输入的密码不一致');
      return;
    }
    
    if (!passwordRequirements.every(req => req.met)) {
      alert('请满足所有密码要求');
      return;
    }

    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    router.push('/login');
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <GridBackground />
      <ParticleBackground />

      <div className={`w-full max-w-md space-y-8 transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        {/* Header */}
        <div className="text-center space-y-4">
          <Link href="/login" className="inline-flex items-center gap-2 text-[#0A82DF]/70 hover:text-[#0A82DF] transition-colors mb-4">
            <ArrowLeft className="h-4 w-4" />
            返回登录
          </Link>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-[#0A82DF] via-white to-[#0A82DF] bg-clip-text text-transparent animate-pulse">
              手机号注册
            </h1>
            <p className="text-[#91CD30] flex items-center justify-center gap-2">
              <Zap className="h-4 w-4" />
              加入青崖管理系统
              <Zap className="h-4 w-4" />
            </p>
          </div>
        </div>

        {/* Register Card */}
        <Card className="relative overflow-hidden border-[#0A82DF]/20 bg-[#001a3d]/90 backdrop-blur-xl shadow-2xl shadow-[#0A82DF]/10">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0A82DF]/5 via-transparent to-[#91CD30]/5" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#0A82DF]/50 to-transparent" />
          
          <CardContent className="relative pt-8 pb-6">
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Phone with Code */}
              <div className="flex gap-2">
                <div className="relative group flex-1">
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="请输入手机号"
                    value={formData.phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                      setFormData({...formData, phone: val});
                    }}
                    required
                    className="h-12 bg-[#002b5c]/50 border-[#0A82DF]/30 focus:border-[#0A82DF] focus:ring-[#0A82DF]/20 pl-11 transition-all duration-300 placeholder:text-[#0A82DF]/50 text-white"
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0A82DF]/50 group-focus-within:text-[#0A82DF] transition-colors">
                    <Smartphone className="h-5 w-5" />
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={handleSendCode}
                  disabled={codeSending || countdown > 0}
                  className="h-12 px-4 bg-[#002b5c]/80 border border-[#0A82DF]/30 hover:bg-[#0A82DF]/20 text-[#0A82DF] text-sm font-medium whitespace-nowrap transition-all"
                >
                  {codeSending ? '发送中...' : countdown > 0 ? `${countdown}秒` : '获取验证码'}
                </Button>
              </div>

              {/* Verification Code */}
              <div className="relative group">
                <Input
                  id="code"
                  type="text"
                  placeholder="请输入6位验证码"
                  value={formData.code}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setFormData({...formData, code: val});
                  }}
                  required
                  className="h-12 bg-[#002b5c]/50 border-[#0A82DF]/30 focus:border-[#0A82DF] focus:ring-[#0A82DF]/20 pl-11 transition-all duration-300 placeholder:text-[#0A82DF]/50 text-white tracking-widest"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0A82DF]/50 group-focus-within:text-[#0A82DF] transition-colors">
                  <Mail className="h-5 w-5" />
                </div>
              </div>

              {/* Password */}
              <div className="relative group">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="请输入密码"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                  className="h-12 bg-[#002b5c]/50 border-[#0A82DF]/30 focus:border-[#0A82DF] focus:ring-[#0A82DF]/20 pl-11 pr-11 transition-all duration-300 placeholder:text-[#0A82DF]/50 text-white"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0A82DF]/50 group-focus-within:text-[#0A82DF] transition-colors pointer-events-none">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#0A82DF]/50 hover:text-[#0A82DF] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>

              {/* Password Requirements */}
              {formData.password && (
                <div className="space-y-1 text-xs">
                  {passwordRequirements.map((req, index) => (
                    <div key={index} className={`flex items-center gap-2 ${req.met ? 'text-[#91CD30]' : 'text-[#0A82DF]/50'}`}>
                      {req.met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      <span>{req.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Confirm Password */}
              <div className="relative group">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="请确认密码"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  required
                  className="h-12 bg-[#002b5c]/50 border-[#0A82DF]/30 focus:border-[#0A82DF] focus:ring-[#0A82DF]/20 pl-11 pr-11 transition-all duration-300 placeholder:text-[#0A82DF]/50 text-white"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0A82DF]/50 group-focus-within:text-[#0A82DF] transition-colors pointer-events-none">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#0A82DF]/50 hover:text-[#0A82DF] transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>

              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="text-red-400 text-xs flex items-center gap-1">
                  <X className="h-3 w-3" />
                  两次输入的密码不一致
                </p>
              )}

              <Button 
                type="submit" 
                className="w-full h-12 text-base font-medium bg-gradient-to-r from-[#004DA7] to-[#0A82DF] hover:from-[#0A82DF] hover:to-[#004DA7] text-white shadow-lg shadow-[#0A82DF]/25 transition-all duration-300 hover:shadow-[#0A82DF]/40 hover:scale-[1.02] active:scale-[0.98]"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    注册中...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    注册
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-[#0A82DF]/50">
          <p>温州青崖信息科技有限公司</p>
          <p className="mt-1">© 2024 All Rights Reserved</p>
        </div>
      </div>
    </div>
  );
}
