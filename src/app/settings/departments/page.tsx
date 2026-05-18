'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface DepartmentRow {
  id: string;
  name: string;
  code: string;
  parent_id?: string | null;
  sort_order?: number;
  status?: string;
  remark?: string | null;
}

export default function DepartmentsPage() {
  const [rows, setRows] = useState<DepartmentRow[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [parentId, setParentId] = useState('none');
  const [remark, setRemark] = useState('');

  const load = async () => {
    const res = await fetch('/api/departments');
    const json = await res.json();
    if (json.success) setRows(json.data || []);
    else toast.error(json.error || '获取部门失败');
  };

  useEffect(() => {
    load().catch(() => null);
  }, []);

  const roots = useMemo(() => rows.filter((row) => !row.parent_id), [rows]);

  const create = async () => {
    const res = await fetch('/api/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, code, parent_id: parentId === 'none' ? null : parentId, remark }),
    });
    const json = await res.json();
    if (!json.success) return toast.error(json.error || '创建部门失败');
    setName('');
    setCode('');
    setParentId('none');
    setRemark('');
    toast.success('部门已创建');
    await load();
  };

  const toggle = async (row: DepartmentRow) => {
    const res = await fetch(`/api/departments/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: row.status === 'active' ? 'disabled' : 'active' }),
    });
    const json = await res.json();
    if (!json.success) return toast.error(json.error || '更新失败');
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">部门管理</h2>
        <p className="text-sm text-muted-foreground">维护组织架构树，供员工、岗位和权限使用。</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">新增部门</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div className="space-y-2">
            <Label>部门名称</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="生产部" />
          </div>
          <div className="space-y-2">
            <Label>部门编码</Label>
            <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="production" />
          </div>
          <div className="space-y-2">
            <Label>上级部门</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">无上级部门</SelectItem>
                {roots.map((row) => <SelectItem key={row.id} value={row.id}>{row.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>备注</Label>
            <Input value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="职责说明" />
          </div>
          <div className="md:col-span-5">
            <Button disabled={!name.trim() || !code.trim()} onClick={create}>保存部门</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">部门树</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>部门</TableHead>
                <TableHead>编码</TableHead>
                <TableHead>上级</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>备注</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const parent = rows.find((item) => item.id === row.parent_id);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.parent_id ? `└ ${row.name}` : row.name}</TableCell>
                    <TableCell className="font-mono text-xs">{row.code}</TableCell>
                    <TableCell>{parent?.name || '-'}</TableCell>
                    <TableCell><Badge variant={row.status === 'active' ? 'default' : 'secondary'}>{row.status === 'active' ? '启用' : '禁用'}</Badge></TableCell>
                    <TableCell>{row.remark || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => toggle(row)}>{row.status === 'active' ? '禁用' : '启用'}</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {rows.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">暂无部门</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}
