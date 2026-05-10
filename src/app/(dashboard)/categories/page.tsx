import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = {
  title: '分类管理',
  description: '管理任务分类',
};

// 占位分类数据 - 实际数据应从 API 获取
const placeholderCategories = [
  { id: 1, name: '工作', color: '#3B82F6', taskCount: 12 },
  { id: 2, name: '学习', color: '#8B5CF6', taskCount: 8 },
  { id: 3, name: '生活', color: '#10B981', taskCount: 5 },
  { id: 4, name: '项目', color: '#F59E0B', taskCount: 15 },
] as const;

export default function CategoriesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">分类管理</h1>
          <p className="text-muted-foreground">查看和管理任务分类</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>分类列表</CardTitle>
            <CardDescription>共 {placeholderCategories.length} 个分类</CardDescription>
          </div>
          <Button size="sm" disabled>
            <Plus className="mr-1 h-4 w-4" />
            新建分类
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">ID</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>颜色</TableHead>
                <TableHead className="text-center">关联任务数</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {placeholderCategories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-mono text-muted-foreground">
                    {category.id}
                  </TableCell>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="gap-1.5"
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.color}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{category.taskCount}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" disabled>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" disabled>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
