'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import Image from 'next/image';
import { Cpu, Layers, Zap } from 'lucide-react';

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

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    router.push('/dashboard');
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <GridBackground />
      <ParticleBackground />

      <div className={`w-full max-w-md space-y-8 transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-[#0A82DF]/30 rounded-2xl blur-xl animate-pulse" />
            <div className="relative flex justify-center mb-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-[#0A82DF]/20 to-[#91CD30]/10 border border-[#0A82DF]/30 backdrop-blur-sm">
                <Image 
                  src="https://code.coze.cn/api/sandbox/coze_coding/file/proxy?expire_time=-1&file_path=assets%2Flogo.jpg&nonce=958fb68e-cf07-47eb-8eb5-380bcae75427&project_id=7634882122565599238&sign=86ff4c2aee1a6ff4e7485566949c74e31eb2d9fe9e5fdb015db3b2c8001cb7ca"
                  alt="青崖Logo" 
                  width={64} 
                  height={64}
                  className="object-contain"
                  priority
                />
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-[#0A82DF] via-white to-[#0A82DF] bg-clip-text text-transparent animate-pulse">
              青崖管理系统
            </h1>
            <p className="text-[#91CD30] flex items-center justify-center gap-2">
              <Zap className="h-4 w-4" />
              智能制造 · 高效管理
              <Zap className="h-4 w-4" />
            </p>
          </div>

          {/* Tech Icons */}
          <div className="flex items-center justify-center gap-6 pt-4">
            <div className="flex items-center gap-2 text-[#0A82DF]/70 text-sm">
              <Cpu className="h-4 w-4" />
              <span>AI驱动</span>
            </div>
            <div className="w-px h-4 bg-[#0A82DF]/30" />
            <div className="flex items-center gap-2 text-[#0A82DF]/70 text-sm">
              <Layers className="h-4 w-4" />
              <span>云端协同</span>
            </div>
            <div className="w-px h-4 bg-[#0A82DF]/30" />
            <div className="flex items-center gap-2 text-[#0A82DF]/70 text-sm">
              <Zap className="h-4 w-4" />
              <span>实时同步</span>
            </div>
          </div>
        </div>

        {/* Login Card */}
        <Card className="relative overflow-hidden border-[#0A82DF]/20 bg-[#001a3d]/90 backdrop-blur-xl shadow-2xl shadow-[#0A82DF]/10">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0A82DF]/5 via-transparent to-[#91CD30]/5" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#0A82DF]/50 to-transparent" />
          
          <CardContent className="relative pt-8 pb-6">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="relative group">
                <Input
                  id="username"
                  type="text"
                  placeholder="请输入账号"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="h-12 bg-[#002b5c]/50 border-[#0A82DF]/30 focus:border-[#0A82DF] focus:ring-[#0A82DF]/20 pl-11 transition-all duration-300 placeholder:text-[#0A82DF]/50 text-white"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0A82DF]/50 group-focus-within:text-[#0A82DF] transition-colors">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>

              <div className="relative group">
                <Input
                  id="password"
                  type="password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 bg-[#002b5c]/50 border-[#0A82DF]/30 focus:border-[#0A82DF] focus:ring-[#0A82DF]/20 pl-11 transition-all duration-300 placeholder:text-[#0A82DF]/50 text-white"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#0A82DF]/50 group-focus-within:text-[#0A82DF] transition-colors">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="remember" 
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    className="border-[#0A82DF]/50 data-[state=checked]:bg-[#0A82DF] data-[state=checked]:border-[#0A82DF]"
                  />
                  <label htmlFor="remember" className="text-sm text-[#0A82DF]/70 cursor-pointer hover:text-[#0A82DF] transition-colors">
                    记住密码
                  </label>
                </div>
                <button type="button" className="text-sm text-[#0A82DF]/70 hover:text-[#0A82DF] transition-colors">
                  忘记密码？
                </button>
              </div>

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
                    登录中...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    登录
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
