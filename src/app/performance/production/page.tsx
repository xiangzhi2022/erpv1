'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface MetricItem {
  name: string;
  value: number;
}

interface ProductionPerf {
  process_output?: MetricItem[];
  workstation_tasks?: MetricItem[];
  rework_rate?: number;
  abnormal_rate?: number;
  pending_assign?: number;
  producing?: number;
  completed?: number;
  total?: number;
}

export default function ProductionPerformancePage() {
  const [data, setData] = useState<ProductionPerf>({});

  useEffect(() => {
    fetch('/api/performance/production')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setData(json.data || {});
      })
      .catch(() => null);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">生产绩效</h1>
        <p className="text-sm text-muted-foreground">查看工序完成量、工位任务量、返工率和异常率。</p>
      </div>
      <div className="grid gap-4 md:grid-cols-5">
        <Summary label="待分配" value={String(data.pending_assign || 0)} />
        <Summary label="生产中" value={String(data.producing || 0)} />
        <Summary label="已完成" value={String(data.completed || 0)} />
        <Summary label="返工率" value={`${(((data.rework_rate || 0) * 100)).toFixed(1)}%`} />
        <Summary label="异常率" value={`${(((data.abnormal_rate || 0) * 100)).toFixed(1)}%`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <MetricTable title="工序完成量" rows={data.process_output || []} />
        <MetricTable title="工位任务量" rows={data.workstation_tasks || []} />
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-2 text-xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function MetricTable({ title, rows }: { title: string; rows: MetricItem[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead className="text-right">数量</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.name}>
                <TableCell>{row.name}</TableCell>
                <TableCell className="text-right">{row.value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
