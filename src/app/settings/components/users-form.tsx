'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface UserItem {
  id: string;
  phone: string;
  real_name: string;
  role: string;
  department: string;
  status: string;
  tenant_type?: string;
  is_active?: boolean;
}

interface RoleOption {
  value: string;
  label: string;
  dept: string;
}

const TENANT_TYPES = [
  { value: 'official', label: '官方管理' },
  { value: 'manufacturer', label: '生产商' },
  { value: 'dealer', label: '经销商' },
  { value: 'material_supplier', label: '材料商' },
];

export function UsersForm() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 当前用户
  const [currentUser, setCurrentUser] = useState<{ phone: string; nickname: string; role: string; tenant_type?: string } | null>(null);

  // 添加用户表单
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('订单管理');
  const [newUserDept, setNewUserDept] = useState('技术/计划');
  const [newUserTenantType, setNewUserTenantType] = useState('');

  // 编辑用户
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editForm, setEditForm] = useState({ name: '', role: '', status: '', department: '' });

  // 加载当前用户
  useEffect(() => {
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = decodeURIComponent(value || '');
      return acc;
    }, {} as Record<string, string>);

    if (cookies['erp_user']) {
      try {
        setCurrentUser(JSON.parse(cookies['erp_user']));
      } catch {
        // ignore
      }
    }
  }, []);

  // 加载角色列表
  useEffect(() => {
    const loadRoles = async () => {
      try {
        const response = await fetch('/api/settings/roles');
        const data = await response.json();
        if (data.success && data.roles) {
          const options = data.roles.map((r: { id: number; role_name: string; dept: string }) => ({
            value: r.role_name,
            label: r.role_name,
            dept: r.dept || '',
          }));
          setRoles(options);
        }
      } catch (error) {
        console.error('加载角色列表失败:', error);
      }
    };
    loadRoles();
  }, []);

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const response = await fetch('/api/settings/users');
      const data = await response.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
      toast.error('获取用户列表失败');
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // 添加用户
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
          department: newUserDept,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setAddUserOpen(false);
        setNewUserPhone('');
        setNewUserName('');
        setNewUserPassword('');
        setNewUserRole('订单管理');
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

  // 编辑用户
  const handleEditUser = (user: UserItem) => {
    setEditingUser(user);
    setEditForm({
      name: user.real_name || '',
      role: user.role,
      status: user.is_active ? 'active' : 'inactive',
      department: user.department || '',
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
        body: JSON.stringify(editForm),
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

  // 切换用户状态
  const handleToggleStatus = (user: UserItem) => {
    const newStatus = user.is_active ? 'inactive' : 'active';
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
      .catch(() => {
        toast.error('状态更新失败');
      });
  };

  // 删除用户
  const handleDeleteUser = async () => {
    if (!editingUser) return;
    const confirmed = window.confirm(`确定要删除用户 "${editingUser.real_name || editingUser.phone}" 吗？此操作不可恢复。`);
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/settings/users?id=${editingUser.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>用户管理</CardTitle>
            <CardDescription>管理系统用户账号</CardDescription>
          </div>
          <Button onClick={() => setAddUserOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
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
                  <th className="text-left py-3 px-4 font-medium">用户名</th>
                  <th className="text-left py-3 px-4 font-medium">姓名</th>
                  <th className="text-left py-3 px-4 font-medium">部门</th>
                  <th className="text-left py-3 px-4 font-medium">角色</th>
                  <th className="text-left py-3 px-4 font-medium">状态</th>
                  <th className="text-left py-3 px-4 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">暂无用户数据</td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-b">
                      <td className="py-3 px-4">{user.phone}</td>
                      <td className="py-3 px-4">{user.real_name || '-'}</td>
                      <td className="py-3 px-4">
                        {(() => {
                          const role = roles.find((r) => r.value === user.role);
                          return role ? (
                            <Badge variant="secondary" className="text-xs">{role.dept}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          );
                        })()}
                      </td>
                      <td className="py-3 px-4">{user.role}</td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleStatus(user)}
                          className={`px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${user.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-400'}`}
                        >
                          {user.is_active ? '启用' : '禁用'}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <Button variant="outline" size="sm" onClick={() => handleEditUser(user)}>
                          <Pencil className="h-3 w-3 mr-1" />
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

      {/* 添加用户弹窗 */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加新用户</DialogTitle>
            <DialogDescription>填写用户信息创建新账号</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {currentUser?.role === 'super_admin' && (
              <div className="space-y-2">
                <Label>租户类型</Label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={newUserTenantType}
                  onChange={(e) => setNewUserTenantType(e.target.value)}
                >
                  {TENANT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label>手机号</Label>
              <Input
                placeholder="请输入手机号"
                value={newUserPhone}
                onChange={(e) => setNewUserPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input
                placeholder="请输入姓名（选填）"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>密码</Label>
              <Input
                type="password"
                placeholder="请输入密码"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <select
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                value={newUserRole}
                onChange={(e) => {
                  setNewUserRole(e.target.value);
                  const role = roles.find((r) => r.value === e.target.value);
                  if (role) setNewUserDept(role.dept);
                }}
              >
                {roles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label} [{role.dept}]
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>部门</Label>
              <Input value={newUserDept} disabled className="bg-muted" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserOpen(false)}>取消</Button>
            <Button onClick={handleAddUser} disabled={isAddingUser || !newUserPhone || !newUserPassword}>
              {isAddingUser ? '添加中...' : '添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑用户弹窗 */}
      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
            <DialogDescription>修改用户信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>用户名</Label>
              <Input value={editingUser?.phone || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input
                placeholder="请输入姓名"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <select
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
              >
                {roles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label} [{role.dept}]
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>状态</Label>
              <select
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              >
                <option value="active">启用</option>
                <option value="inactive">禁用</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>部门</Label>
              <Input
                value={(() => {
                  const role = roles.find((r) => r.value === editForm.role);
                  return role ? role.dept : editForm.department || '-';
                })()}
                disabled
                className="bg-muted"
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 mr-1" />
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
