'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DealerOrderDetail {
  order_no?: string;
  customer_name?: string;
  external_status?: string;
  expected_ship_date?: string | null;
  shipping_status?: string;
  logistics?: string | null;
  remark?: string | null;
  timeline?: string[];
}

export default function DealerOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<DealerOrderDetail | null>(null);

  useEffect(() => {
    fetch(`/api/dealer/orders/${params.id}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setDetail(json.data);
      })
      .catch(() => null);
  }, [params.id]);

  if (!detail) return <div className="text-sm text-muted-foreground">正在加载订单...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{detail.order_no}</h1>
        <p className="text-sm text-muted-foreground">{detail.customer_name}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Info label="外部进度" value={detail.external_status || '-'} />
        <Info label="预计发货" value={detail.expected_ship_date || '-'} />
        <Info label="发货状态" value={detail.shipping_status || '-'} />
        <Info label="物流信息" value={detail.logistics || '-'} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">订单时间轴</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {(detail.timeline || []).map((item) => {
            const active = item === detail.external_status;
            return (
              <div key={item} className="flex items-center gap-3">
                <div className={active ? 'h-3 w-3 rounded-full bg-primary' : 'h-3 w-3 rounded-full bg-muted-foreground/30'} />
                <span className={active ? 'font-medium' : 'text-muted-foreground'}>{item}</span>
                {active ? <Badge>当前</Badge> : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">备注</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">{detail.remark || '暂无备注'}</CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-2 font-medium">{value}</div>
      </CardContent>
    </Card>
  );
}
