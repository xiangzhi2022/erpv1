'use client';

import { useState, useEffect } from 'react';
import { useUnsavedChanges } from '@/app/settings/components/unsaved-changes-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, Bell, Mail, Package, Factory, Settings } from 'lucide-react';

interface NotificationSettings {
  order_notification: boolean;
  production_notification: boolean;
  system_notification: boolean;
  email_notification: boolean;
}

const defaultSettings: NotificationSettings = {
  order_notification: true,
  production_notification: true,
  system_notification: true,
  email_notification: false,
};

const notificationItems = [
  {
    key: 'order_notification' as const,
    title: '订单通知',
    description: '接收新订单、订单状态变更等通知',
    icon: Package,
  },
  {
    key: 'production_notification' as const,
    title: '生产通知',
    description: '接收生产任务、进度更新等通知',
    icon: Factory,
  },
  {
    key: 'system_notification' as const,
    title: '系统通知',
    description: '接收系统维护、安全提醒等通知',
    icon: Settings,
  },
  {
    key: 'email_notification' as const,
    title: '邮件通知',
    description: '同时将通知发送到您的邮箱',
    icon: Mail,
  },
];

export function NotificationsForm() {
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { setDirty } = useUnsavedChanges();

  useEffect(() => {
    setDirty(hasChanges);
  }, [hasChanges, setDirty]);

  // 加载偏好设置
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const res = await fetch('/api/settings/preferences');
        const data = await res.json();
        if (data.success && data.preferences) {
          const loaded: NotificationSettings = { ...defaultSettings };
          if (data.preferences.order_notification !== undefined) {
            loaded.order_notification = data.preferences.order_notification === 'true';
          }
          if (data.preferences.production_notification !== undefined) {
            loaded.production_notification = data.preferences.production_notification === 'true';
          }
          if (data.preferences.system_notification !== undefined) {
            loaded.system_notification = data.preferences.system_notification === 'true';
          }
          if (data.preferences.email_notification !== undefined) {
            loaded.email_notification = data.preferences.email_notification === 'true';
          }
          setSettings(loaded);
        }
      } catch (err) {
        console.error('加载通知设置失败:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPreferences();
  }, []);

  const handleToggle = (key: keyof NotificationSettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 逐项保存
      for (const [key, value] of Object.entries(settings)) {
        await fetch('/api/settings/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value: String(value) }),
        });
      }
      toast.success('通知设置已保存');
      setHasChanges(false);
      setDirty(false);
    } catch {
      toast.error('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          通知设置
        </CardTitle>
        <CardDescription>选择您希望接收的通知类型</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {notificationItems.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={item.key}>
              {idx > 0 && <Separator className="my-3" />}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <Label htmlFor={item.key} className="text-sm font-medium cursor-pointer">
                      {item.title}
                    </Label>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <Switch
                  id={item.key}
                  checked={settings[item.key]}
                  onCheckedChange={() => handleToggle(item.key)}
                />
              </div>
            </div>
          );
        })}

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            保存更改
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
