'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UserInfo {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  provider?: string;
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 检查会话状态（通过 cookie 间接判断）
    // 实际项目中应通过 API 验证会话
    setLoading(false);
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-slate-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 顶栏 */}
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-slate-800" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <span className="font-bold text-slate-900 text-lg">平台</span>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <User className="h-4 w-4" />
                  {user.name}
                </div>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-1" />
                  退出
                </Button>
              </div>
            ) : (
              <Button onClick={() => router.push('/login')} size="sm" className="rounded-lg bg-slate-900 hover:bg-slate-800">
                登录
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* 主体 */}
      <main className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">
            欢迎使用平台
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            一站式智能解决方案，助您高效管理、轻松协作
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Button
              onClick={() => router.push('/login')}
              className="rounded-lg bg-slate-900 hover:bg-slate-800 h-11 px-8"
            >
              开始使用
            </Button>
          </div>
        </div>

        {/* 功能卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          {[
            { title: 'OAuth 登录', desc: '支持微信、GitHub、Google 三方快捷登录' },
            { title: '密码管理', desc: '密码重置、邮箱验证，安全有保障' },
            { title: '验证码防护', desc: 'SVG 图形验证码，防止暴力破解' },
          ].map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-xl border border-slate-100 p-6 hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold text-slate-900 mb-2">{item.title}</h3>
              <p className="text-sm text-slate-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
