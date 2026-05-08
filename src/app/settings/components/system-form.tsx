'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function SystemForm() {
  const [isSaving, setIsSaving] = useState(false);
  const [backupCycle, setBackupCycle] = useState('每天');
  const [logRetention, setLogRetention] = useState('90');
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [minPasswordLength, setMinPasswordLength] = useState('6');

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 保存系统配置到 user_settings
      const settings = [
        { key: 'backup_cycle', value: backupCycle },
        { key: 'log_retention_days', value: logRetention },
        { key: 'session_timeout_minutes', value: sessionTimeout },
        { key: 'min_password_length', value: minPasswordLength },
      ];

      for (const setting of settings) {
        await fetch('/api/settings/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(setting),
        });
      }

      toast.success('系统配置已保存');
    } catch {
      toast.error('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>系统配置</CardTitle>
        <CardDescription>系统运行参数配置</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>数据备份周期</Label>
            <Input
              value={backupCycle}
              onChange={(e) => setBackupCycle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>日志保留天数</Label>
            <Input
              value={logRetention}
              onChange={(e) => setLogRetention(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>会话超时时间(分钟)</Label>
            <Input
              value={sessionTimeout}
              onChange={(e) => setSessionTimeout(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>密码最小长度</Label>
            <Input
              value={minPasswordLength}
              onChange={(e) => setMinPasswordLength(e.target.value)}
            />
          </div>
        </div>
        <Separator />
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
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
      </CardContent>
    </Card>
  );
}
