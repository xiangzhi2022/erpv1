import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export const metadata: Metadata = {
  title: '数据同步',
  description: '数据同步管理',
};

// 占位同步状态
const syncStatus: {
  lastSync: string;
  status: 'idle' | 'running' | 'success' | 'failed';
  source: string;
} = {
  lastSync: '2026-05-08 18:00:00',
  status: 'idle',
  source: '外部数据源',
};

const syncHistory = [
  { id: 1, time: '2026-05-08 18:00:00', status: 'success', records: 42 },
  { id: 2, time: '2026-05-07 18:00:00', status: 'success', records: 38 },
  { id: 3, time: '2026-05-06 18:00:00', status: 'failed', records: 0 },
  { id: 4, time: '2026-05-05 18:00:00', status: 'success', records: 45 },
] as const;

function StatusBadge({ status }: { status: 'success' | 'failed' | 'idle' | 'running' }) {
  const variants: Record<string, { icon: React.ReactNode; label: string; variant: 'default' | 'destructive' | 'outline' | 'secondary' }> = {
    success: { icon: <CheckCircle2 className="h-3 w-3" />, label: '成功', variant: 'default' },
    failed: { icon: <AlertTriangle className="h-3 w-3" />, label: '失败', variant: 'destructive' },
    idle: { icon: <Clock className="h-3 w-3" />, label: '空闲', variant: 'secondary' },
    running: { icon: <RefreshCw className="h-3 w-3 animate-spin" />, label: '同步中', variant: 'outline' },
  };

  const config = variants[status] ?? variants.idle;

  return (
    <Badge variant={config.variant} className="gap-1">
      {config.icon}
      {config.label}
    </Badge>
  );
}

export default function SyncPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">数据同步</h1>
          <p className="text-muted-foreground">管理数据同步任务与查看同步历史</p>
        </div>
      </div>

      {/* 同步状态卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            同步状态
            <StatusBadge status={syncStatus.status} />
          </CardTitle>
          <CardDescription>
            数据源：{syncStatus.source}
            {' | '}
            上次同步：{syncStatus.lastSync}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {/* 同步按钮带二次确认，防止误操作 */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={syncStatus.status === 'running'}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${syncStatus.status === 'running' ? 'animate-spin' : ''}`} />
                  立即同步
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认执行数据同步？</AlertDialogTitle>
                  <AlertDialogDescription>
                    此操作将从外部数据源拉取最新数据并覆盖本地记录。
                    同步过程中请勿关闭页面，完成后将显示同步结果。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction>确认同步</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <p className="text-xs text-muted-foreground">
              同步操作不可撤销，请确认后执行
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 安全提示 */}
      <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            注意事项
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-amber-700 dark:text-amber-300">
          <ul className="list-inside list-disc space-y-1">
            <li>同步操作将更新本地数据，请确保数据源配置正确</li>
            <li>同步过程中请勿刷新页面或重复点击同步按钮</li>
            <li>如同步失败，请检查网络连接后重试</li>
          </ul>
        </CardContent>
      </Card>

      {/* 同步历史 */}
      <Card>
        <CardHeader>
          <CardTitle>同步历史</CardTitle>
          <CardDescription>近期同步记录</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {syncHistory.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between rounded-md border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <StatusBadge status={record.status} />
                  <span className="text-sm text-muted-foreground">{record.time}</span>
                </div>
                <span className="text-sm">
                  {record.status === 'success'
                    ? `${record.records} 条记录`
                    : '无记录'}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
