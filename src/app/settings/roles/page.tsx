'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface RoleRow {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  status?: string;
  tenant_id?: string | null;
  permission_codes?: string[];
}

interface PermissionRow {
  id: string;
  name: string;
  code: string;
  module?: string;
  description?: string | null;
}

interface RoleScope {
  is_super_admin?: boolean;
  tenant_id?: string | null;
  business_type?: string;
  message?: string;
}

interface ApiListResponse<T> {
  success?: boolean;
  data?: T[];
  error?: string;
  scope?: RoleScope;
}

interface ApiPermissionsResponse {
  success?: boolean;
  data?: string[];
  error?: string;
}

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [scope, setScope] = useState<RoleScope | null>(null);
  const [selectedRole, setSelectedRole] = useState<RoleRow | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ name: '', code: '', description: '' });

  const load = async () => {
    const [roleRes, permissionRes] = await Promise.all([fetch('/api/roles'), fetch('/api/permissions')]);
    const [roleJson, permissionJson] = await Promise.all([
      roleRes.json() as Promise<ApiListResponse<RoleRow>>,
      permissionRes.json() as Promise<ApiListResponse<PermissionRow>>,
    ]);
    if (roleJson.success) {
      setRoles(roleJson.data || []);
      setScope(roleJson.scope || permissionJson.scope || null);
    } else {
      toast.error(roleJson.error || '获取角色失败');
    }
    if (permissionJson.success) {
      setPermissions(permissionJson.data || []);
    } else {
      toast.error(permissionJson.error || '获取权限失败');
    }
  };

  useEffect(() => {
    load().catch(() => null);
  }, []);

  const create = async () => {
    const res = await fetch('/api/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!json.success) return toast.error(json.error || '创建角色失败');
    setForm({ name: '', code: '', description: '' });
    toast.success('角色已创建');
    await load();
  };

  const openRole = async (role: RoleRow) => {
    setSelectedRole(role);
    const res = await fetch(`/api/roles/${role.id}/permissions`);
    const json = await res.json() as ApiPermissionsResponse;
    if (!json.success) {
      toast.error(json.error || '获取角色权限失败');
      setSelectedPermissions(new Set());
      return;
    }
    const codes = json.success ? json.data || role.permission_codes || [] : role.permission_codes || [];
    setSelectedPermissions(new Set(codes));
  };

  const savePermissions = async () => {
    if (!selectedRole) return;
    const res = await fetch(`/api/roles/${selectedRole.id}/permissions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permission_codes: Array.from(selectedPermissions) }),
    });
    const json = await res.json();
    if (!json.success) return toast.error(json.error || '保存权限失败');
    toast.success('角色权限已保存');
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">角色权限</h2>
        <p className="text-sm text-muted-foreground">维护角色，并通过权限矩阵控制页面、操作和字段权限。</p>
      </div>

      <Alert>
        <AlertTitle>权限分配范围</AlertTitle>
        <AlertDescription>
          {scope?.message || '超级管理员可管理全部企业；其他管理员只能维护本企业、对应业务类型的角色权限。'}
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader><CardTitle className="text-base">新增角色</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_2fr_auto] md:items-end">
          <div className="space-y-2">
            <Label>角色名称</Label>
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="生产主管" />
          </div>
          <div className="space-y-2">
            <Label>角色编码</Label>
            <Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="production_manager" />
          </div>
          <div className="space-y-2">
            <Label>说明</Label>
            <Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </div>
          <Button disabled={!form.name.trim() || !form.code.trim()} onClick={create}>保存</Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader><CardTitle className="text-base">角色列表</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>角色</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div className="font-medium">{role.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{role.code}</div>
                    </TableCell>
                    <TableCell><Badge variant={role.status === 'active' ? 'default' : 'secondary'}>{role.status || 'active'}</Badge></TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => openRole(role)}>权限</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{selectedRole ? `${selectedRole.name} 权限矩阵` : '权限矩阵'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedRole ? <div className="text-sm text-muted-foreground">选择左侧角色后分配权限。</div> : null}
            {selectedRole ? (
              <>
                <div className="grid gap-2 md:grid-cols-2">
                  {permissions.map((permission) => (
                    <label key={permission.code} className="flex items-start gap-3 rounded-md border p-3 text-sm">
                      <Checkbox checked={selectedPermissions.has(permission.code)} onCheckedChange={(checked) => {
                        setSelectedPermissions((prev) => {
                          const next = new Set(prev);
                          if (checked === true) next.add(permission.code);
                          else next.delete(permission.code);
                          return next;
                        });
                      }} />
                      <span>
                        <span className="block font-medium">{permission.name}</span>
                        <span className="block font-mono text-xs text-muted-foreground">{permission.code}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <Button onClick={savePermissions}>保存权限</Button>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
