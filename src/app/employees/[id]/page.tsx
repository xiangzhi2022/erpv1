'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Relation<T> {
  id: string;
  position?: T;
  role?: T;
}

interface EmployeeDetail {
  id: string;
  employee_no?: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
  status?: string;
  department?: { name?: string; code?: string } | null;
  primary_position?: {
    name?: string;
    code?: string;
    can_receive_production_task?: boolean;
    can_calculate_piece_wage?: boolean;
    can_review_task?: boolean;
    can_assign_task?: boolean;
  } | null;
  positions?: Array<Relation<{
    name?: string;
    code?: string;
    can_receive_production_task?: boolean;
    can_calculate_piece_wage?: boolean;
    can_review_task?: boolean;
    can_assign_task?: boolean;
  }>>;
  roles?: Array<Relation<{ name?: string; code?: string; description?: string }>>;
}

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<EmployeeDetail | null>(null);

  useEffect(() => {
    fetch(`/api/employees/${params.id}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setDetail(json.data);
      })
      .catch(() => null);
  }, [params.id]);

  const permissions = useMemo(() => {
    const flags = new Set<string>();
    const positions = [
      detail?.primary_position,
      ...(detail?.positions || []).map((item) => item.position),
    ].filter(Boolean);
    for (const position of positions) {
      if (position?.can_receive_production_task) flags.add('可接生产任务');
      if (position?.can_calculate_piece_wage) flags.add('参与计件工资');
      if (position?.can_review_task) flags.add('可审核任务');
      if (position?.can_assign_task) flags.add('可分配任务');
    }
    for (const role of detail?.roles || []) {
      if (role.role?.code) flags.add(`角色：${role.role.code}`);
    }
    return Array.from(flags);
  }, [detail]);

  if (!detail) {
    return <div className="text-sm text-muted-foreground">正在加载员工详情...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{detail.name}</h1>
        <p className="text-sm text-muted-foreground">{detail.employee_no} · {detail.department?.name || '未绑定部门'}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard label="联系方式" value={`${detail.phone || '-'} / ${detail.email || '-'}`} />
        <InfoCard label="主岗位" value={detail.primary_position?.name || '-'} />
        <InfoCard label="状态" value={detail.status === 'active' ? '在职' : detail.status || '-'} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">权限摘要</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {permissions.map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}
          {permissions.length === 0 ? <span className="text-sm text-muted-foreground">暂无岗位或角色权限</span> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">岗位与角色</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>类型</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>编码</TableHead>
                <TableHead>说明</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(detail.positions || []).map((item) => (
                <TableRow key={`p-${item.id}`}>
                  <TableCell>岗位</TableCell>
                  <TableCell>{item.position?.name || '-'}</TableCell>
                  <TableCell className="font-mono text-xs">{item.position?.code || '-'}</TableCell>
                  <TableCell>{item.position?.can_receive_production_task ? '可接生产任务' : '普通岗位'}</TableCell>
                </TableRow>
              ))}
              {(detail.roles || []).map((item) => (
                <TableRow key={`r-${item.id}`}>
                  <TableCell>角色</TableCell>
                  <TableCell>{item.role?.name || '-'}</TableCell>
                  <TableCell className="font-mono text-xs">{item.role?.code || '-'}</TableCell>
                  <TableCell>{item.role?.description || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-2 font-medium">{value}</div>
      </CardContent>
    </Card>
  );
}
