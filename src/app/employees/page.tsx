'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Edit, MoreHorizontal, Plus, RefreshCw, Search, ShieldCheck, Trash2, UserCheck, UserX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

interface DepartmentRow {
  id: string;
  name: string;
  code?: string;
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
  permission_codes?: string[];
}

interface Relation<T> {
  position?: T | null;
  role?: T | null;
}

interface EmployeeRow {
  id: string;
  user_id?: string | null;
  employee_no?: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
  department_id?: string | null;
  primary_position_id?: string | null;
  department?: DepartmentRow | null;
  primary_position?: PositionRow | null;
  positions?: Array<Relation<PositionRow>>;
  roles?: Array<Relation<RoleRow>>;
  status?: string;
  employee_type?: string | null;
  hire_date?: string | null;
  leave_date?: string | null;
  base_salary?: string | number | null;
  remark?: string | null;
}

interface EmployeeForm {
  id?: string;
  user_id: string;
  employee_no: string;
  name: string;
  phone: string;
  email: string;
  department_id: string;
  primary_position_id: string;
  employee_type: string;
  status: string;
  hire_date: string;
  leave_date: string;
  base_salary: string;
  remark: string;
  password: string;
  create_account: boolean;
}

const EMPTY_FORM: EmployeeForm = {
  user_id: '',
  employee_no: '',
  name: '',
  phone: '',
  email: '',
  department_id: 'none',
  primary_position_id: 'none',
  employee_type: 'full_time',
  status: 'active',
  hire_date: '',
  leave_date: '',
  base_salary: '0',
  remark: '',
  password: '',
  create_account: false,
};

const employeeTypeLabel: Record<string, string> = {
  full_time: '全职',
  part_time: '兼职',
  temporary: '临时',
  outsourced: '外协',
};

const statusLabel: Record<string, string> = {
  active: '在职',
  inactive: '停用',
  probation: '试用',
  resigned: '离职',
};

function normalizeSelectValue(value?: string | null) {
  return value && value.trim() ? value : 'none';
}

function relationIds<T extends { id: string }>(items: Array<Relation<T>> | undefined, key: 'role' | 'position') {
  return (items || []).map((item) => item[key]?.id).filter((value): value is string => Boolean(value));
}

function employeeToForm(employee: EmployeeRow): EmployeeForm {
  return {
    id: employee.id,
    user_id: employee.user_id || '',
    employee_no: employee.employee_no || '',
    name: employee.name || '',
    phone: employee.phone || '',
    email: employee.email || '',
    department_id: normalizeSelectValue(employee.department_id || employee.department?.id),
    primary_position_id: normalizeSelectValue(employee.primary_position_id || employee.primary_position?.id),
    employee_type: employee.employee_type || 'full_time',
    status: employee.status || 'active',
    hire_date: employee.hire_date || '',
    leave_date: employee.leave_date || '',
    base_salary: employee.base_salary === null || employee.base_salary === undefined ? '0' : String(employee.base_salary),
    remark: employee.remark || '',
    password: '',
    create_account: Boolean(employee.user_id),
  };
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('all');
  const [departmentId, setDepartmentId] = useState('all');
  const [positionId, setPositionId] = useState('all');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<EmployeeForm>(EMPTY_FORM);
  const [roleIds, setRoleIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<EmployeeRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword.trim()) params.set('keyword', keyword.trim());
      if (status !== 'all') params.set('status', status);
      if (departmentId !== 'all') params.set('department_id', departmentId);
      if (positionId !== 'all') params.set('position_id', positionId);
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
      else toast.error(employeeJson.error || '获取员工失败');
      if (departmentJson.success) setDepartments(departmentJson.data || []);
      if (positionJson.success) setPositions(positionJson.data || []);
      if (roleJson.success) setRoles(roleJson.data || []);
    } finally {
      setLoading(false);
    }
  }, [departmentId, keyword, positionId, status]);

  useEffect(() => {
    load().catch(() => toast.error('加载员工数据失败'));
  }, [load]);

  const stats = useMemo(() => {
    const active = employees.filter((employee) => employee.status === 'active').length;
    const inactive = employees.filter((employee) => employee.status !== 'active').length;
    const accountLinked = employees.filter((employee) => Boolean(employee.user_id)).length;
    return { active, inactive, accountLinked, total: employees.length };
  }, [employees]);

  const selectedPosition = positions.find((item) => item.id === form.primary_position_id);
  const isEditing = Boolean(form.id);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setRoleIds(new Set());
    setDialogOpen(true);
  };

  const openEdit = (employee: EmployeeRow) => {
    setForm(employeeToForm(employee));
    setRoleIds(new Set(relationIds(employee.roles, 'role')));
    setDialogOpen(true);
  };

  const payloadFromForm = () => ({
    ...form,
    user_id: form.user_id || null,
    department_id: form.department_id === 'none' ? null : form.department_id,
    primary_position_id: form.primary_position_id === 'none' ? null : form.primary_position_id,
    position_ids: form.primary_position_id === 'none' ? [] : [form.primary_position_id],
    role_ids: Array.from(roleIds),
    create_account: form.create_account,
    password: form.password || undefined,
    base_salary: Number(form.base_salary || 0),
  });

  const saveEmployee = async () => {
    if (!form.employee_no.trim() || !form.name.trim()) {
      toast.error('请填写工号和姓名');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(form.id ? `/api/employees/${form.id}` : '/api/employees', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadFromForm()),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || '保存员工失败');
        return;
      }
      toast.success(form.id ? '员工已更新' : '员工已创建');
      setDialogOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const setEmployeeStatus = async (employee: EmployeeRow, nextStatus: string) => {
    const res = await fetch(`/api/employees/${employee.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus, leave_date: nextStatus === 'active' ? null : employee.leave_date }),
    });
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error || '更新状态失败');
      return;
    }
    toast.success(nextStatus === 'active' ? '员工已恢复在职' : '员工已停用');
    await load();
  };

  const deleteEmployee = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/employees/${deleteTarget.id}?hard=1`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || '删除员工失败');
        return;
      }
      toast.success('员工已删除');
      setDeleteTarget(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">员工管理中心</h1>
          <p className="text-sm text-muted-foreground">维护员工档案、岗位、角色，并同步工厂、经销商、供应商的账号权限。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => load()} disabled={loading}>
            <RefreshCw className="size-4" />
            刷新
          </Button>
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            新增员工
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">员工总数</div>
            <div className="mt-2 text-2xl font-semibold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">在职员工</div>
            <div className="mt-2 text-2xl font-semibold">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">停用/离职</div>
            <div className="mt-2 text-2xl font-semibold">{stats.inactive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">已开通账号</div>
            <div className="mt-2 text-2xl font-semibold">{stats.accountLinked}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">筛选</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_180px_180px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void load();
              }}
              placeholder="搜索姓名 / 工号 / 手机号"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="active">在职</SelectItem>
              <SelectItem value="probation">试用</SelectItem>
              <SelectItem value="inactive">停用</SelectItem>
              <SelectItem value="resigned">离职</SelectItem>
            </SelectContent>
          </Select>
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部部门</SelectItem>
              {departments.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={positionId} onValueChange={setPositionId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部岗位</SelectItem>
              {positions.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => load()} disabled={loading}>查询</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">员工列表</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>员工</TableHead>
                <TableHead>联系方式</TableHead>
                <TableHead>组织</TableHead>
                <TableHead>角色权限</TableHead>
                <TableHead>账号</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => {
                const employeeRoles = (employee.roles || []).map((item) => item.role).filter(Boolean) as RoleRow[];
                return (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <div className="font-medium">{employee.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{employee.employee_no}</div>
                    </TableCell>
                    <TableCell>
                      <div>{employee.phone || '-'}</div>
                      <div className="text-xs text-muted-foreground">{employee.email || ''}</div>
                    </TableCell>
                    <TableCell>
                      <div>{employee.department?.name || '-'}</div>
                      <div className="text-xs text-muted-foreground">{employee.primary_position?.name || '未绑定岗位'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-[260px] flex-wrap gap-1">
                        {employeeRoles.length > 0
                          ? employeeRoles.map((role) => <Badge key={role.id} variant="secondary">{role.name}</Badge>)
                          : <span className="text-xs text-muted-foreground">未分配角色</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {employee.user_id ? (
                        <Badge variant="outline" className="gap-1"><ShieldCheck className="size-3" />已开通</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">仅档案</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={employee.status === 'active' ? 'default' : 'secondary'}>
                        {statusLabel[employee.status || 'active'] || employee.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" aria-label="员工操作">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(employee)}>
                            <Edit className="size-4" />
                            编辑
                          </DropdownMenuItem>
                          {employee.status === 'active' ? (
                            <DropdownMenuItem onClick={() => setEmployeeStatus(employee, 'inactive')}>
                              <UserX className="size-4" />
                              停用
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => setEmployeeStatus(employee, 'active')}>
                              <UserCheck className="size-4" />
                              恢复在职
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(employee)}>
                            <Trash2 className="size-4" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {employees.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">暂无员工</div> : null}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[860px]">
          <DialogHeader>
            <DialogTitle>{isEditing ? '编辑员工' : '新增员工'}</DialogTitle>
            <DialogDescription>员工档案会写入 Supabase；勾选角色后会同步到员工角色关系，绑定账号后会同步登录权限。</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>工号</Label>
              <Input value={form.employee_no} onChange={(event) => setForm({ ...form, employee_no: event.target.value })} placeholder="E001" />
            </div>
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="张三" />
            </div>
            <div className="space-y-2">
              <Label>手机号</Label>
              <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="用于联系或登录账号" />
            </div>
            <div className="space-y-2">
              <Label>邮箱</Label>
              <Input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@example.com" />
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
            <div className="space-y-2">
              <Label>员工类型</Label>
              <Select value={form.employee_type} onValueChange={(value) => setForm({ ...form, employee_type: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(employeeTypeLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>状态</Label>
              <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>入职日期</Label>
              <Input type="date" value={form.hire_date} onChange={(event) => setForm({ ...form, hire_date: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>离职日期</Label>
              <Input type="date" value={form.leave_date} onChange={(event) => setForm({ ...form, leave_date: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>基础工资</Label>
              <Input type="number" min="0" value={form.base_salary} onChange={(event) => setForm({ ...form, base_salary: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>登录账号</Label>
              <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
                <Checkbox checked={form.create_account} onCheckedChange={(checked) => setForm({ ...form, create_account: checked === true })} />
                同步开通/绑定登录账号
              </label>
            </div>
            {form.create_account && !form.user_id ? (
              <div className="space-y-2 md:col-span-2">
                <Label>初始密码</Label>
                <Input value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="留空则默认使用手机号后 6 位" />
              </div>
            ) : null}
            <div className="space-y-2 md:col-span-2">
              <Label>备注</Label>
              <Textarea value={form.remark} onChange={(event) => setForm({ ...form, remark: event.target.value })} placeholder="员工技能、排班说明、账号备注等" />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="font-medium">角色权限</div>
              <div className="text-sm text-muted-foreground">管理员可给工厂、经销商、供应商员工分配当前企业可管理的角色；绑定账号后会同步为登录权限。</div>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {roles.map((role) => (
                <label key={role.id} className="flex items-start gap-2 rounded-md border p-3 text-sm">
                  <Checkbox
                    checked={roleIds.has(role.id)}
                    onCheckedChange={(checked) => {
                      setRoleIds((prev) => {
                        const next = new Set(prev);
                        if (checked === true) next.add(role.id);
                        else next.delete(role.id);
                        return next;
                      });
                    }}
                  />
                  <span>
                    <span className="block font-medium">{role.name}</span>
                    <span className="block font-mono text-xs text-muted-foreground">{role.code}</span>
                  </span>
                </label>
              ))}
            </div>
            {selectedPosition ? (
              <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                当前岗位：{selectedPosition.can_receive_production_task ? '可接生产任务' : '不接生产任务'}，
                {selectedPosition.can_calculate_piece_wage ? '参与计件工资' : '不参与计件工资'}。
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>取消</Button>
            <Button onClick={saveEmployee} disabled={saving}>{saving ? '保存中...' : '保存员工'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除员工？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后会移除员工档案与岗位/角色关系；如果该员工绑定了登录账号，也会清理对应权限。此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>取消</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={saving} onClick={deleteEmployee}>
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
