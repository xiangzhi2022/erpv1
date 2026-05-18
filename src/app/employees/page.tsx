'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
}

interface PositionRow {
  id: string;
  name: string;
  code: string;
  can_receive_production_task?: boolean;
  can_calculate_piece_wage?: boolean;
}

interface RoleRow {
  id: string;
  name: string;
  code: string;
}

interface EmployeeRow {
  id: string;
  employee_no?: string;
  name?: string;
  phone?: string | null;
  department?: DepartmentRow | null;
  primary_position?: PositionRow | null;
  status?: string;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [keyword, setKeyword] = useState('');
  const [form, setForm] = useState({
    employee_no: '',
    name: '',
    phone: '',
    department_id: 'none',
    primary_position_id: 'none',
  });
  const [roleIds, setRoleIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (keyword.trim()) params.set('keyword', keyword.trim());
    const [employeeRes, departmentRes, positionRes, roleRes] = await Promise.all([
      fetch(`/api/employees?${params}`),
      fetch('/api/departments'),
      fetch('/api/positions'),
      fetch('/api/roles'),
    ]);
    const [employeeJson, departmentJson, positionJson, roleJson] = await Promise.all([
      employeeRes.json(),
      departmentRes.json(),
      positionRes.json(),
      roleRes.json(),
    ]);
    if (employeeJson.success) setEmployees(employeeJson.data || []);
    if (departmentJson.success) setDepartments(departmentJson.data || []);
    if (positionJson.success) setPositions(positionJson.data || []);
    if (roleJson.success) setRoles(roleJson.data || []);
  }, [keyword]);

  useEffect(() => {
    load().catch(() => null);
  }, [load]);

  const primaryPosition = useMemo(
    () => positions.find((position) => position.id === form.primary_position_id),
    [form.primary_position_id, positions]
  );

  const create = async () => {
    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        department_id: form.department_id === 'none' ? null : form.department_id,
        primary_position_id: form.primary_position_id === 'none' ? null : form.primary_position_id,
        position_ids: form.primary_position_id === 'none' ? [] : [form.primary_position_id],
        role_ids: Array.from(roleIds),
      }),
    });
    const json = await res.json();
    if (!json.success) return toast.error(json.error || '创建员工失败');
    setForm({ employee_no: '', name: '', phone: '', department_id: 'none', primary_position_id: 'none' });
    setRoleIds(new Set());
    toast.success('员工已创建');
    await load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">员工管理</h1>
          <p className="text-sm text-muted-foreground">维护员工档案，并绑定部门、岗位和角色。</p>
        </div>
        <div className="flex gap-2">
          <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} onKeyDown={(event) => {
            if (event.key === 'Enter') void load();
          }} placeholder="搜索姓名 / 工号 / 电话" />
          <Button variant="outline" onClick={() => load()}>搜索</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">新增员工</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div className="space-y-2">
            <Label>工号</Label>
            <Input value={form.employee_no} onChange={(event) => setForm({ ...form, employee_no: event.target.value })} placeholder="E001" />
          </div>
          <div className="space-y-2">
            <Label>姓名</Label>
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="张三" />
          </div>
          <div className="space-y-2">
            <Label>电话</Label>
            <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="手机号" />
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
            <Label>主岗位</Label>
            <Select value={form.primary_position_id} onValueChange={(value) => setForm({ ...form, primary_position_id: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不绑定岗位</SelectItem>
                {positions.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-5">
            <div className="mb-2 text-sm font-medium">角色</div>
            <div className="grid gap-2 md:grid-cols-4">
              {roles.map((role) => (
                <label key={role.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <Checkbox checked={roleIds.has(role.id)} onCheckedChange={(checked) => {
                    setRoleIds((prev) => {
                      const next = new Set(prev);
                      if (checked === true) next.add(role.id);
                      else next.delete(role.id);
                      return next;
                    });
                  }} />
                  {role.name}
                </label>
              ))}
            </div>
          </div>
          <div className="md:col-span-5 flex items-center gap-3">
            <Button disabled={!form.employee_no.trim() || !form.name.trim()} onClick={create}>保存员工</Button>
            {primaryPosition ? (
              <span className="text-xs text-muted-foreground">
                当前岗位：{primaryPosition.can_receive_production_task ? '可接生产任务' : '不可接生产任务'}，
                {primaryPosition.can_calculate_piece_wage ? '参与计件' : '不参与计件'}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">员工列表</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>员工</TableHead>
                <TableHead>电话</TableHead>
                <TableHead>部门</TableHead>
                <TableHead>岗位</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <div className="font-medium">{employee.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{employee.employee_no}</div>
                  </TableCell>
                  <TableCell>{employee.phone || '-'}</TableCell>
                  <TableCell>{employee.department?.name || '-'}</TableCell>
                  <TableCell>{employee.primary_position?.name || '-'}</TableCell>
                  <TableCell><Badge variant={employee.status === 'active' ? 'default' : 'secondary'}>{employee.status === 'active' ? '在职' : '停用'}</Badge></TableCell>
                  <TableCell className="text-right"><Button asChild size="sm" variant="outline"><Link href={`/employees/${employee.id}`}>详情</Link></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {employees.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">暂无员工</div> : null}
        </CardContent>
      </Card>
    </div>
  );
}
