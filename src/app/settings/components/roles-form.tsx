'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Pencil, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

interface UserItem {
  id: string;
  phone: string;
  real_name: string | null;
  role: string;
  department: string | null;
  status: string;
  tenant_name?: string;
  is_active?: boolean;
  permissions?: string[];
  permission_labels?: string[];
}

interface AccountRoleOption {
  value: string;
  label: string;
  department: string;
  description: string;
}

interface PermissionOption {
  value: string;
  label: string;
  businessType: string;
  department: string;
  description: string;
}

const STATUS_OPTIONS = [
  { value: 'active', label: '启用' },
  { value: 'inactive', label: '禁用' },
];

function PermissionSelector({
  options,
  value,
  onChange,
}: {
  options: PermissionOption[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (permission: string, checked: boolean) => {
    if (checked) onChange(Array.from(new Set([...value, permission])));
    else onChange(value.filter((item) => item !== permission));
  };

  if (options.length === 0) {
    return <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">当前账号没有可分配的员工权限。</div>;
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => (
        <label key={option.value} className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 hover:bg-muted/50">
          <Checkbox checked={value.includes(option.value)} onCheckedChange={(checked) => toggle(option.value, checked === true)} />
          <span className="min-w-0 text-sm">
            <span className="block font-medium">{option.label}</span>
            <span className="block text-xs text-muted-foreground">{option.department} · {option.businessType}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export function RolesForm() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [accountRoles, setAccountRoles] = useState<AccountRoleOption[]>([]);
  const [permissions, setPermissions] = useState<PermissionOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editForm, setEditForm] = useState({ role: 'employee', department: '', status: 'active', permissions: [] as string[] });
  const [keyword, setKeyword] = useState('');

  const fetchRoles = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/roles');
      const data = await response.json();
      if (data.success) {
        setAccountRoles(data.accountRoles || []);
        setPermissions(data.permissions || []);
      } else {
        toast.error(data.error || '获取权限模板失败');
      }
    } catch {
      toast.error('获取权限模板失败');
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings/users');
      const data = await response.json();
      if (data.success) setUsers(data.users || []);
      else toast.error(data.error || '获取用户权限失败');
    } catch {
      toast.error('获取用户权限失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
    fetchUsers();
  }, [fetchRoles, fetchUsers]);

  const roleOptions = accountRoles.length > 0 ? accountRoles : [{ value: 'employee', label: '员工', department: '员工', description: '员工账号' }];

  const roleLabel = (role: string) => roleOptions.find((item) => item.value === role)?.label || role;
  const permissionDescription = (permissionKeys: string[]) => {
    if (permissionKeys.length === 0) return '未分配员工权限';
    return permissionKeys
      .map((key) => permissions.find((item) => item.value === key)?.label || key)
      .join('、');
  };

  const filteredUsers = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) => {
      return [user.phone, user.real_name, user.role, roleLabel(user.role), user.department, user.tenant_name, ...(user.permission_labels || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [keyword, users, roleOptions, permissions]);

  const openEditor = (user: UserItem) => {
    setEditingUser(user);
    setEditForm({
      role: user.role || 'employee',
      department: user.department || '',
      status: user.status || (user.is_active ? 'active' : 'inactive'),
      permissions: user.permissions || [],
    });
  };

  const savePermission = async () => {
    if (!editingUser) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/settings/users?id=${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: editForm.role,
          department: editForm.department,
          status: editForm.status,
          permissions: editForm.role === 'employee' ? editForm.permissions : [],
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success('用户权限已更新');
        setEditingUser(null);
        fetchUsers();
      } else {
        toast.error(data.error || '保存权限失败');
      }
    } catch {
      toast.error('保存权限失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>角色权限管理</CardTitle>
            <CardDescription>账号层级负责管理员范围，员工权限支持多岗位组合</CardDescription>
          </div>
          <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索手机号、姓名、权限..." className="w-full md:w-72" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">暂无用户权限数据</div>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((user) => {
              const permissionLabels = user.permission_labels || [];
              return (
                <div key={user.id} className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-base font-semibold">{user.real_name || user.phone}</div>
                        <Badge variant={user.status === 'active' || user.is_active ? 'default' : 'secondary'}>
                          {user.status === 'active' || user.is_active ? '启用' : '禁用'}
                        </Badge>
                        {user.tenant_name ? <Badge variant="outline">{user.tenant_name}</Badge> : null}
                      </div>
                      <div className="text-sm text-muted-foreground">{user.phone}</div>
                    </div>

                    <div className="grid gap-3 text-sm md:grid-cols-3 lg:w-[620px]">
                      <div>
                        <div className="text-xs text-muted-foreground">账号角色</div>
                        <div className="mt-1 font-medium">{roleLabel(user.role)}</div>
                        <div className="text-xs text-muted-foreground">{user.role}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">部门/岗位</div>
                        <div className="mt-1 font-medium">{user.department || '-'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">员工权限</div>
                        <div className="mt-1 line-clamp-2 text-muted-foreground">
                          {permissionLabels.length > 0 ? permissionLabels.join('、') : '-'}
                        </div>
                      </div>
                    </div>

                    <Button variant="outline" size="sm" onClick={() => openEditor(user)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      修改权限
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>修改用户权限</DialogTitle>
            <DialogDescription>
              {editingUser ? `${editingUser.real_name || editingUser.phone}（${editingUser.phone}）` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>账号角色</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={editForm.role} onChange={(event) => setEditForm((form) => ({ ...form, role: event.target.value }))}>
                  {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>账号状态</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={editForm.status} onChange={(event) => setEditForm((form) => ({ ...form, status: event.target.value }))}>
                  {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>部门/岗位</Label>
              <Input value={editForm.department} onChange={(event) => setEditForm((form) => ({ ...form, department: event.target.value }))} placeholder="可留空，由权限自动推导" />
            </div>

            {editForm.role === 'employee' ? (
              <div className="space-y-2">
                <Label>员工权限</Label>
                <PermissionSelector options={permissions} value={editForm.permissions} onChange={(next) => setEditForm((form) => ({ ...form, permissions: next }))} />
              </div>
            ) : null}

            <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
                <ShieldCheck className="h-4 w-4" />
                当前权限说明
              </div>
              {editForm.role === 'employee' ? permissionDescription(editForm.permissions) : roleOptions.find((item) => item.value === editForm.role)?.description || '管理员账号'}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>取消</Button>
            <Button onClick={savePermission} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              保存权限
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
