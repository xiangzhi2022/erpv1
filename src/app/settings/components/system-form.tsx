'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const SYSTEM_SETTING_KEYS = [
  { key: 'backup_cycle', label: '数据备份周期', default: '每天' },
  { key: 'log_retention_days', label: '日志保留天数', default: '90' },
  { key: 'session_timeout_minutes', label: '会话超时时间(分钟)', default: '30' },
  { key: 'min_password_length', label: '密码最小长度', default: '6' },
] as const;

type SystemSettingKey = (typeof SYSTEM_SETTING_KEYS)[number]['key'];

export function SystemForm() {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [settings, setSettings] = useState<Record<SystemSettingKey, string>>(() => {
    const defaults: Record<string, string> = {};
    for (const item of SYSTEM_SETTING_KEYS) {
      defaults[item.key] = item.default;
    }
    return defaults as Record<SystemSettingKey, string>;
  });
  const [initialSettings, setInitialSettings] = useState<Record<SystemSettingKey, string> | null>(null);

  // 加载已有设置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings/preferences');
        const data = await res.json();
        if (data.success && data.preferences) {
          const loaded = { ...settings };
          for (const item of SYSTEM_SETTING_KEYS) {
            if (data.preferences[item.key] !== undefined) {
              loaded[item.key] = data.preferences[item.key];
            }
          }
          setSettings(loaded);
          setInitialSettings(loaded);
        }
      } catch (err) {
        console.error('加载系统设置失败:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 检测变更
  useEffect(() => {
    if (!initialSettings) return;
    const changed = SYSTEM_SETTING_KEYS.some(
      (item) => settings[item.key] !== initialSettings[item.key]
    );
    setHasChanges(changed);
  }, [settings, initialSettings]);

  const handleSettingChange = (key: SystemSettingKey, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 逐项保存到 user_settings
      for (const item of SYSTEM_SETTING_KEYS) {
        const response = await fetch('/api/settings/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: item.key, value: settings[item.key] }),
        });
        const data = await response.json();
        if (!data.success) {
          toast.error(data.error || `保存${item.label}失败`);
          return;
        }
      }

      toast.success('系统配置已保存');
      setInitialSettings({ ...settings });
      setHasChanges(false);
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
        <CardTitle>系统配置</CardTitle>
        <CardDescription>系统运行参数配置</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          {SYSTEM_SETTING_KEYS.map((item) => (
            <div key={item.key} className="space-y-2">
              <Label>{item.label}</Label>
              <Input
                value={settings[item.key]}
                onChange={(e) => handleSettingChange(item.key, e.target.value)}
              />
            </div>
          ))}
        </div>
        <Separator />
        <div className="flex justify-between items-center">
          {hasChanges && (
            <span className="text-sm text-amber-600">您有未保存的更改</span>
          )}
          <div className="ml-auto flex gap-2">
            {hasChanges && (
              <Button
                variant="outline"
                onClick={() => {
                  if (initialSettings) {
                    setSettings({ ...initialSettings });
                    setHasChanges(false);
                  }
                }}
              >
                撤销更改
              </Button>
            )}
            <Button onClick={handleSave} disabled={isSaving || !hasChanges}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  保存中...
                </>
              ) : (
                '保存设置'
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
