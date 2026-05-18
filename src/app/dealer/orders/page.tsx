'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface DealerOrder {
  id: string;
  order_no?: string;
  customer_name?: string;
  status?: string;
  external_status?: string;
  progress?: string;
  expected_ship_date?: string | null;
  shipping_status?: string;
  created_at?: string;
}

export default function DealerOrdersPage() {
  const [rows, setRows] = useState<DealerOrder[]>([]);
  const [keyword, setKeyword] = useState('');

  const load = async () => {
    const res = await fetch('/api/dealer/orders');
    const json = await res.json();
    if (json.success) setRows(json.orders || json.data || []);
  };

  useEffect(() => {
    load().catch(() => null);
  }, []);

  const visibleRows = rows.filter((row) => {
    const text = [row.order_no, row.customer_name, row.external_status].filter(Boolean).join(' ').toLowerCase();
    return !keyword.trim() || text.includes(keyword.trim().toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">我的订单</h1>
          <p className="text-sm text-muted-foreground">查看订单外部进度、预计发货时间和物流状态。</p>
        </div>
        <Input className="md:w-80" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索订单号或客户" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">订单列表</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>订单编号</TableHead>
                <TableHead>客户名称</TableHead>
                <TableHead>订单状态</TableHead>
                <TableHead>生产进度</TableHead>
                <TableHead>预计发货</TableHead>
                <TableHead>发货状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.order_no}</TableCell>
                  <TableCell>{row.customer_name || '-'}</TableCell>
                  <TableCell><Badge variant="secondary">{row.external_status || row.status}</Badge></TableCell>
                  <TableCell>{row.progress || '-'}</TableCell>
                  <TableCell>{row.expected_ship_date || '-'}</TableCell>
                  <TableCell>{row.shipping_status || '-'}</TableCell>
                  <TableCell>{row.created_at ? new Date(row.created_at).toLocaleDateString('zh-CN') : '-'}</TableCell>
                  <TableCell className="text-right"><Button asChild size="sm" variant="outline"><Link href={`/dealer/orders/${row.id}`}>详情</Link></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {visibleRows.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">暂无订单</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}
