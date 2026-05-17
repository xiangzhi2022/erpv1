'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface WageRow {
  id: string;
  wage_amount?: number | string;
  quantity?: number | string;
  status?: string;
  created_at?: string;
  task?: { task_no?: string; task_name?: string; process_name?: string } | null;
}

function yuan(value: unknown): string {
  const parsed = typeof value === 'number' ? value : Number(value || 0);
  return Number.isFinite(parsed) ? `¥${parsed.toFixed(2)}` : '-';
}

export default function WorkerWagesPage() {
  const [rows, setRows] = useState<WageRow[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({ pending: 0, approved: 0, paid: 0, today_total: 0, week_total: 0, month_total: 0 });

  useEffect(() => {
    fetch('/api/worker/me/wages')
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
        <h1 className="text-2xl font-bold tracking-tight">我的工资</h1>
        <p className="text-sm text-muted-foreground">显示当前工人的计件工资明细和待审核、已确认、已发放状态。</p>
      </div>
      <div className="grid gap-4 md:grid-cols-6">
        <SummaryCard label="今日工资" value={yuan(summary.today_total)} />
        <SummaryCard label="本周工资" value={yuan(summary.week_total)} />
        <SummaryCard label="本月累计" value={yuan(summary.month_total)} />
        <SummaryCard label="待审核" value={yuan(summary.pending)} />
        <SummaryCard label="已确认" value={yuan(summary.approved)} />
        <SummaryCard label="已发放" value={yuan(summary.paid)} />
      </div>
      <Card>
        <CardHeader><CardTitle>工资明细</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日期</TableHead>
                <TableHead>任务</TableHead>
                <TableHead>工序</TableHead>
                <TableHead>数量</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">金额</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.created_at ? new Date(row.created_at).toLocaleDateString('zh-CN') : '-'}</TableCell>
                  <TableCell>{row.task?.task_no || row.task?.task_name || '-'}</TableCell>
                  <TableCell>{row.task?.process_name || '-'}</TableCell>
                  <TableCell>{row.quantity || '-'}</TableCell>
                  <TableCell><Badge variant="secondary">{row.status}</Badge></TableCell>
                  <TableCell className="text-right">{yuan(row.wage_amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {rows.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">暂无工资记录</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-2 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
