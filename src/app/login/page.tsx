'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Factory } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate login
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Redirect to dashboard
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Factory className="h-12 w-12 text-primary" />
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">生产管理系统</h1>
            <p className="text-muted-foreground">ERP Management System</p>
          </div>

          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6">
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="username">账号</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="请输入账号"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">密码</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="请输入密码"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="remember" 
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    />
                    <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                      记住密码
                    </Label>
                  </div>
                </div>

                <Button type="submit" className="w-full h-11 text-base font-medium" disabled={loading}>
                  {loading ? '登录中...' : '登录'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="text-center text-sm text-muted-foreground">
            <p>管理员：admin</p>
          </div>
        </div>
      </div>

      {/* Right side - Decorative */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 items-center justify-center">
        <div className="text-center space-y-4 p-8">
          <h2 className="text-4xl font-bold text-primary/80">某某生产管理系统</h2>
          <p className="text-xl text-muted-foreground">智能制造 · 高效管理</p>
          <div className="grid grid-cols-2 gap-8 mt-12 max-w-md mx-auto">
            <div className="text-center p-4 rounded-lg bg-background/50 backdrop-blur">
              <div className="text-3xl font-bold text-primary">50+</div>
              <div className="text-sm text-muted-foreground">完成订单</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-background/50 backdrop-blur">
              <div className="text-3xl font-bold text-primary">8</div>
              <div className="text-sm text-muted-foreground">生产中</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-background/50 backdrop-blur">
              <div className="text-3xl font-bold text-primary">10</div>
              <div className="text-sm text-muted-foreground">待排产</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-background/50 backdrop-blur">
              <div className="text-3xl font-bold text-primary">3</div>
              <div className="text-sm text-muted-foreground">待接收</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
