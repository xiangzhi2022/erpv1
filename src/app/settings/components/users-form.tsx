'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface UserItem {
  id: string;
  phone: string;
  real_name: string | null;
  role: string;
  department: string | null;
  status: string;
  tenant_id?: string | null;
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

interface TenantOption {
  id: string;
  company_name?: string;
  name?: string;
  tenant_type?: string;
}

const STATUS_OPTIONS = [
  { value: 'active', label: '启用' },
  { value: 'inactive', label: '禁用' },
];

function PermissionChecklist({
  options,
  value,
  onChange,
}: {
  options: PermissionOption[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const grouped = useMemo(() => {
    return options.reduce<Record<string, PermissionOption[]>>((groups, option) => {
      const key = option.businessType;
      groups[key] = groups[key] || [];
      groups[key].push(option);
      return groups;
    }, {});
  }, [options]);

  const toggle = (permission: string, checked: boolean) => {
    if (checked) onChange(Array.from(new Set([...value, permission])));
    else onChange(value.filter((item) => item !== permission));
  };

  if (options.length === 0) {
    return <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">当前账号没有可分配的员工权限。</div>;
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      {Object.entries(grouped).map(([group, items]) => (
        <div key={group} className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">{group}</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map((option) => (
              <label key={option.value} className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm hover:bg-muted/50">
                <Checkbox checked={value.includes(option.value)} onCheckedChange={(checked) => toggle(option.value, checked === true)} />
                <span className="min-w-0">
                  <span className="block font-medium">{option.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{option.department}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function UsersForm() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [accountRoles, setAccountRoles] = useState<AccountRoleOption[]>([]);
  const [permissions, setPermissions] = useState<PermissionOption[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('employee');
  const [newUserTenantId, setNewUserTenantId] = useState('');
  const [newUserPermissions, setNewUserPermissions] = useState<string[]>([]);

  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editForm, setEditForm] = useState({ name: '', role: 'employee', status: 'active', department: '', tenant_id: '', permissions: [] as string[] });

  const loadRoles = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/roles');
      const data = await response.json();
      if (data.success) {
        setAccountRoles(data.accountRoles || []);
        setPermissions(data.permissions || []);
      }
    } catch {
      toast.error('加载角色权限失败');
    }
  }, []);

  const loadTenants = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/tenants');
      if (!response.ok) return;
      const data = await response.json();
      if (data.success) setTenants(data.tenants || []);
    } catch {
      // Non-super admins cannot load tenant list. That is expected.
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const response = await fetch('/api/settings/users');
      const data = await response.json();
      if (data.success) setUsers(data.users || []);
      else toast.error(data.error || '获取用户列表失败');
    } catch {
      toast.error('获取用户列表失败');
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
    loadTenants();
    fetchUsers();
  }, [fetchUsers, loadRoles, loadTenants]);

  const roleLabel = (role: string) => accountRoles.find((item) => item.value === role)?.label || role;
  const canChooseTenant = tenants.length > 0;

  const resetAddForm = () => {
    setNewUserPhone('');
    setNewUserName('');
    setNewUserPassword('');
    setNewUserRole('employee');
    setNewUserTenantId('');
    setNewUserPermissions([]);
  };

  const handleAddUser = async () => {
    if (!newUserPhone || !newUserPassword) return;
    setIsAddingUser(true);
    try {
      const response = await fetch('/api/settings/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: newUserPhone,
          password: newUserPassword,
          real_name: newUserName || newUserPhone,
          role: newUserRole,
          tenant_id: newUserTenantId || undefined,
          permissions: newUserRole === 'employee' ? newUserPermissions : [],
        }),
      });
      const data = await response.json();
      if (data.success) {
        setAddUserOpen(false);
        resetAddForm();
        fetchUsers();
        toast.success('用户添加成功');
      } else {
        toast.error(data.error || '添加用户失败');
      }
    } catch {
      toast.error('添加用户失败');
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleEditUser = (user: UserItem) => {
    setEditingUser(user);
    setEditForm({
      name: user.real_name || '',
      role: user.role || 'employee',
      status: user.status || (user.is_active ? 'active' : 'inactive'),
      department: user.department || '',
      tenant_id: user.tenant_id || '',
      permissions: user.permissions || [],
    });
    setEditUserOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/settings/users?id=${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          real_name: editForm.name,
          role: editForm.role,
          status: editForm.status,
          department: editForm.department,
          tenant_id: editForm.tenant_id || undefined,
          permissions: editForm.role === 'employee' ? editForm.permissions : [],
        }),
      });
      const data = await response.json();
      if (data.success) {
        setEditUserOpen(false);
        setEditingUser(null);
        fetchUsers();
        toast.success('用户信息已更新');
      } else {
        toast.error(data.error || '更新失败');
      }
    } catch {
      toast.error('更新失败');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleStatus = (user: UserItem) => {
    const newStatus = user.status === 'active' || user.is_active ? 'inactive' : 'active';
    fetch(`/api/settings/users?id=${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          fetchUsers();
          toast.success(`用户已${newStatus === 'active' ? '启用' : '禁用'}`);
        } else {
          toast.error(data.error || '状态更新失败');
        }
      })
      .catch(() => toast.error('状态更新失败'));
  };

  const handleDeleteUser = async () => {
    if (!editingUser) return;
    if (!window.confirm(`确定要删除用户 "${editingUser.real_name || editingUser.phone}" 吗？此操作不可恢复。`)) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/settings/users?id=${editingUser.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setEditUserOpen(false);
        setEditingUser(null);
        fetchUsers();
        toast.success('用户已删除');
      } else {
        toast.error(data.error || '删除失败');
      }
    } catch {
      toast.error('删除失败');
    } finally {
      setIsDeleting(false);
    }
  };

  const roleOptions = accountRoles.length > 0 ? accountRoles : [{ value: 'employee', label: '员工', department: '员工', description: '员工账号' }];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>用户管理</CardTitle>
            <CardDescription>管理账号层级和员工多岗位权限</CardDescription>
          </div>
          <Button onClick={() => setAddUserOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            添加用户
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoadingUsers ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-medium">账号</th>
                  <th className="px-4 py-3 text-left font-medium">姓名</th>
                  <th className="px-4 py-3 text-left font-medium">角色</th>
                  <th className="px-4 py-3 text-left font-medium">员工权限</th>
                  <th className="px-4 py-3 text-left font-medium">企业</th>
                  <th className="px-4 py-3 text-left font-medium">状态</th>
                  <th className="px-4 py-3 text-left font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">暂无用户数据</td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-b align-top">
                      <td className="px-4 py-3">{user.phone}</td>
                      <td className="px-4 py-3">{user.real_name || '-'}</td>
                      <td className="px-4 py-3">{roleLabel(user.role)}</td>
                      <td className="px-4 py-3">
                        <div className="flex max-w-[320px] flex-wrap gap-1">
                          {(user.permission_labels || []).length > 0 ? (
                            user.permission_labels?.map((label) => <Badge key={label} variant="secondary">{label}</Badge>)
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">{user.tenant_name || '-'}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleStatus(user)}
                          className={`rounded-full px-2 py-1 text-xs font-medium transition-colors ${user.status === 'active' || user.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                        >
                          {user.status === 'active' || user.is_active ? '启用' : '禁用'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <Button variant="outline" size="sm" onClick={() => handleEditUser(user)}>
                          <Pencil className="mr-1 h-3 w-3" />
                          编辑
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>添加新用户</DialogTitle>
            <DialogDescription>二级管理员只能创建本企业员工，超级管理员可创建二级管理员或员工。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>手机号</Label>
              <Input placeholder="请输入手机号" value={newUserPhone} onChange={(event) => setNewUserPhone(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input placeholder="请输入姓名（选填）" value={newUserName} onChange={(event) => setNewUserName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>密码</Label>
              <Input type="password" placeholder="请输入密码" value={newUserPassword} onChange={(event) => setNewUserPassword(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>账号角色</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={newUserRole} onChange={(event) => setNewUserRole(event.target.value)}>
                {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
            </div>
            {canChooseTenant ? (
              <div className="space-y-2 md:col-span-2">
                <Label>所属企业</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={newUserTenantId} onChange={(event) => setNewUserTenantId(event.target.value)}>
                  <option value="">不指定</option>
                  {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.company_name || tenant.name || tenant.id}</option>)}
                </select>
              </div>
            ) : null}
            {newUserRole === 'employee' ? (
              <div className="space-y-2 md:col-span-2">
                <Label>员工权限</Label>
                <PermissionChecklist options={permissions} value={newUserPermissions} onChange={setNewUserPermissions} />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserOpen(false)}>取消</Button>
            <Button onClick={handleAddUser} disabled={isAddingUser || !newUserPhone || !newUserPassword}>
              {isAddingUser ? '添加中...' : '添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
            <DialogDescription>修改账号层级、状态和员工多岗位权限</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>手机号</Label>
              <Input value={editingUser?.phone || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>账号角色</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={editForm.role} onChange={(event) => setEditForm({ ...editForm, role: event.target.value })}>
                {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>状态</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value })}>
                {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            {canChooseTenant ? (
              <div className="space-y-2 md:col-span-2">
                <Label>所属企业</Label>
                <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={editForm.tenant_id} onChange={(event) => setEditForm({ ...editForm, tenant_id: event.target.value })}>
                  <option value="">不指定</option>
                  {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.company_name || tenant.name || tenant.id}</option>)}
                </select>
              </div>
            ) : null}
            <div className="space-y-2 md:col-span-2">
              <Label>部门</Label>
              <Input value={editForm.department} onChange={(event) => setEditForm({ ...editForm, department: event.target.value })} placeholder="可留空，由权限自动推导" />
            </div>
            {editForm.role === 'employee' ? (
              <div className="space-y-2 md:col-span-2">
                <Label>员工权限</Label>
                <PermissionChecklist options={permissions} value={editForm.permissions} onChange={(next) => setEditForm({ ...editForm, permissions: next })} />
              </div>
            ) : null}
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button variant="destructive" onClick={handleDeleteUser} disabled={isDeleting}>
              <Trash2 className="mr-1 h-4 w-4" />
              {isDeleting ? '删除中...' : '删除'}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditUserOpen(false)}>取消</Button>
              <Button onClick={handleSaveEdit} disabled={isUpdating}>
                {isUpdating ? '保存中...' : '保存'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
