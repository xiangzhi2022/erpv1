import type { Metadata } from 'next';
import Link from 'next/link';
import { FolderTree, RefreshCw, ArrowRight } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: '仪表盘',
  description: 'ERP 管理平台总览',
};

const quickLinks = [
  {
    title: '分类管理',
    description: '管理任务分类，查看和编辑分类列表',
    href: '/categories',
    icon: FolderTree,
  },
  {
    title: '数据同步',
    description: '同步外部数据源，查看同步状态与历史',
    href: '/sync',
    icon: RefreshCw,
  },
] as const;

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">仪表盘</h1>
        <p className="text-muted-foreground">ERP 管理平台总览与快速入口</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {quickLinks.map((link) => (
          <Card key={link.href}>
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                <link.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">{link.title}</CardTitle>
                <CardDescription className="text-sm">
                  {link.description}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" asChild>
                <Link href={link.href}>
                  进入
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
