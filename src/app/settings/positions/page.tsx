'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface DepartmentRow {
  id: string;
  name: string;
  code: string;
}

interface PositionRow {
  id: string;
  name: string;
  code: string;
  position_type?: string;
  department_id?: string | null;
  department?: DepartmentRow | null;
  can_receive_production_task?: boolean;
  can_calculate_piece_wage?: boolean;
  can_review_task?: boolean;
  can_assign_task?: boolean;
  default_role_code?: string | null;
  status?: string;
}

const ROLE_OPTIONS = ['worker', 'production_manager', 'finance', 'data_entry', 'dealer', 'warehouse', 'quality_inspector', 'delivery_staff', 'business_staff', 'boss', 'admin'];

export default function PositionsPage() {
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [form, setForm] = useState({
    name: '',
    code: '',
    department_id: 'none',
    position_type: 'general',
    default_role_code: 'worker',
    can_receive_production_task: false,
    can_calculate_piece_wage: false,
    can_review_task: false,
    can_assign_task: false,
  });

  const load = async () => {
    const [positionRes, departmentRes] = await Promise.all([
      fetch('/api/positions'),
      fetch('/api/departments'),
    ]);
    const [positionJson, departmentJson] = await Promise.all([positionRes.json(), departmentRes.json()]);
    if (positionJson.success) setPositions(positionJson.data || []);
    if (departmentJson.success) setDepartments(departmentJson.data || []);
  };

  useEffect(() => {
    load().catch(() => null);
  }, []);

  const create = async () => {
    const res = await fetch('/api/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, department_id: form.department_id === 'none' ? null : form.department_id }),
    });
    const json = await res.json();
    if (!json.success) return toast.error(json.error || '创建岗位失败');
    setForm({
      name: '',
      code: '',
      department_id: 'none',
      position_type: 'general',
      default_role_code: 'worker',
      can_receive_production_task: false,
      can_calculate_piece_wage: false,
      can_review_task: false,
      can_assign_task: false,
    });
    toast.success('岗位已创建');
    await load();
  };

  const toggle = async (row: PositionRow) => {
    const res = await fetch(`/api/positions/${row.id}`, {
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
        <h2 className="text-2xl font-semibold tracking-tight">岗位管理</h2>
        <p className="text-sm text-muted-foreground">岗位决定是否可接生产任务、是否参与计件工资以及审核/分配能力。</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">新增岗位</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="space-y-2">
            <Label>岗位名称</Label>
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="开料工" />
          </div>
          <div className="space-y-2">
            <Label>岗位编码</Label>
            <Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="cutting_worker" />
          </div>
          <div className="space-y-2">
            <Label>部门</Label>
            <Select value={form.department_id} onValueChange={(value) => setForm({ ...form, department_id: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不绑定部门</SelectItem>
                {departments.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>默认角色</Label>
            <Select value={form.default_role_code} onValueChange={(value) => setForm({ ...form, default_role_code: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>岗位类型</Label>
            <Input value={form.position_type} onChange={(event) => setForm({ ...form, position_type: event.target.value })} />
          </div>
          <Flag label="可接生产任务" checked={form.can_receive_production_task} onChange={(value) => setForm({ ...form, can_receive_production_task: value })} />
          <Flag label="参与计件工资" checked={form.can_calculate_piece_wage} onChange={(value) => setForm({ ...form, can_calculate_piece_wage: value })} />
          <Flag label="可审核任务" checked={form.can_review_task} onChange={(value) => setForm({ ...form, can_review_task: value })} />
          <Flag label="可分配任务" checked={form.can_assign_task} onChange={(value) => setForm({ ...form, can_assign_task: value })} />
          <div className="md:col-span-4">
            <Button disabled={!form.name.trim() || !form.code.trim()} onClick={create}>保存岗位</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">岗位列表</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>岗位</TableHead>
                <TableHead>部门</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>能力</TableHead>
                <TableHead>默认角色</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{row.code}</div>
                  </TableCell>
                  <TableCell>{row.department?.name || '-'}</TableCell>
                  <TableCell>{row.position_type || '-'}</TableCell>
                  <TableCell className="space-x-1">
                    {row.can_receive_production_task ? <Badge variant="secondary">接任务</Badge> : null}
                    {row.can_calculate_piece_wage ? <Badge variant="secondary">计件</Badge> : null}
                    {row.can_review_task ? <Badge variant="secondary">审核</Badge> : null}
                    {row.can_assign_task ? <Badge variant="secondary">分配</Badge> : null}
                  </TableCell>
                  <TableCell>{row.default_role_code || '-'}</TableCell>
                  <TableCell><Badge variant={row.status === 'active' ? 'default' : 'secondary'}>{row.status === 'active' ? '启用' : '禁用'}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => toggle(row)}>{row.status === 'active' ? '禁用' : '启用'}</Button>
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

function Flag({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      {label}
    </label>
  );
}
