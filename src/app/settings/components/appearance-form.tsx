'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Sun, Moon, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const themes = [
  {
    value: 'light',
    label: '浅色模式',
    description: '适合明亮环境下使用',
    icon: Sun,
  },
  {
    value: 'dark',
    label: '深色模式',
    description: '适合暗光环境下使用，减少眼睛疲劳',
    icon: Moon,
  },
  {
    value: 'system',
    label: '跟随系统',
    description: '根据操作系统的主题设置自动切换',
    icon: Monitor,
  },
] as const;

export function AppearanceForm() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // 避免 hydration 不匹配
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeChange = async (value: string) => {
    setTheme(value);
    try {
      await fetch('/api/settings/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'theme', value }),
      });
      toast.success(`已切换到${themes.find((t) => t.value === value)?.label}`);
    } catch {
      // 即使保存到服务端失败，主题也已经本地切换了
      toast.success(`已切换到${themes.find((t) => t.value === value)?.label}`);
    }
  };

  if (!mounted) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>外观设置</CardTitle>
          <CardDescription>自定义系统的外观和主题</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-base font-medium">主题模式</Label>
            <p className="text-sm text-muted-foreground mt-1">
              选择您偏好的界面主题，更改会立即生效
            </p>
          </div>

          <RadioGroup
            value={theme}
            onValueChange={handleThemeChange}
            className="grid gap-3"
          >
            {themes.map((t) => (
              <Label
                key={t.value}
                htmlFor={`theme-${t.value}`}
                className={cn(
                  'flex items-center gap-4 rounded-lg border p-4 cursor-pointer transition-colors',
                  theme === t.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-accent/50'
                )}
              >
                <RadioGroupItem value={t.value} id={`theme-${t.value}`} />
                <t.icon className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="font-medium">{t.label}</div>
                  <div className="text-sm text-muted-foreground">
                    {t.description}
                  </div>
                </div>
                {theme === t.value && (
                  <div className="h-2 w-2 rounded-full bg-primary" />
                )}
              </Label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>
    </div>
  );
}
