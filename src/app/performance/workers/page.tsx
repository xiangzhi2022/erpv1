'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface WorkerPerf {
  id: string;
  name?: string;
  worker_no?: string;
  craft_type?: string;
  task_count?: number;
  completed_task_count?: number;
  output_quantity?: number;
  rework_count?: number;
  pending_wage?: number;
  approved_wage?: number;
}

function yuan(value: unknown): string {
  const parsed = typeof value === 'number' ? value : Number(value || 0);
  return Number.isFinite(parsed) ? `¥${parsed.toFixed(2)}` : '-';
}

export default function WorkerPerformancePage() {
  const [rows, setRows] = useState<WorkerPerf[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch('/api/performance/workers')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setRows(json.data || []);
          setSummary(json.summary || {});
        }
      })
      .catch(() => null);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">工人绩效</h1>
        <p className="text-sm text-muted-foreground">查看工人任务完成量、返工和工资统计。</p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Summary label="工人数" value={String(summary.workers || 0)} />
        <Summary label="生产任务" value={String(summary.tasks || 0)} />
        <Summary label="已完成任务" value={String(summary.completed_tasks || 0)} />
        <Summary label="已确认工资" value={yuan(summary.approved_wage)} />
      </div>
      <Card>
        <CardHeader><CardTitle>绩效排行</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>工人</TableHead>
                <TableHead>工种</TableHead>
                <TableHead>任务数</TableHead>
                <TableHead>完成数</TableHead>
                <TableHead>产量</TableHead>
                <TableHead>返工/异常</TableHead>
                <TableHead className="text-right">待审核工资</TableHead>
                <TableHead className="text-right">已确认工资</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.worker_no} · {row.name}</TableCell>
                  <TableCell>{row.craft_type || '-'}</TableCell>
                  <TableCell>{row.task_count || 0}</TableCell>
                  <TableCell>{row.completed_task_count || 0}</TableCell>
                  <TableCell>{row.output_quantity || 0}</TableCell>
                  <TableCell>{row.rework_count || 0}</TableCell>
                  <TableCell className="text-right">{yuan(row.pending_wage)}</TableCell>
                  <TableCell className="text-right">{yuan(row.approved_wage)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-2 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
