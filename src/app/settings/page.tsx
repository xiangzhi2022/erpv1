'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Check, X, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DraggableDialog } from '@/components/ui/draggable-dialog';

export default function SettingsPage() {
  const [prefix, setPrefix] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [verifyResult, setVerifyResult] = useState<{ available: boolean; message: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [prefixes, setPrefixes] = useState<Array<{prefix: string; company_name: string; phone: string; address: string}>>([]);
  
  const [users, setUsers] = useState<Array<{id: string; phone: string; name: string; role: string; department: string; status: string; tenant_type?: string}>>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('订单管理');
  const [newUserDept, setNewUserDept] = useState('技术/计划');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<{id: string; phone: string; name: string; role: string; status: string} | null>(null);
  const [editForm, setEditForm] = useState({ name: '', role: '', status: '', department: '' });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentTenantType, setCurrentTenantType] = useState<string>('');
  const [newUserTenantType, setNewUserTenantType] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<{phone: string; nickname: string; role: string; tenant_type?: string} | null>(null);
  
  // 租户类型定义
  const TENANT_TYPES = [
    { value: 'official', label: '官方管理', icon: '🔧' },
    { value: 'manufacturer', label: '生产商', icon: '🏭' },
    { value: 'dealer', label: '经销商', icon: '🏪' },
    { value: 'material_supplier', label: '材料商', icon: '📦' },
  ];
  
  // 生产商岗位角色列表（20个核心岗位）
  const MANUFACTURER_ROLES = [
  ];
  
  // 经销商岗位角色
  const DEALER_ROLES = [
    { value: '订单管理', label: '1 订单管理', dept: '管理' },
    { value: '木工', label: '2 木工', dept: '生产' },
    { value: '打磨', label: '3 打磨', dept: '生产' },
    { value: '贴皮', label: '4 贴皮', dept: '生产' },
    { value: '喷漆', label: '5 喷漆', dept: '生产' },
    { value: '质检', label: '6 质检', dept: '生产' },
    { value: '打包', label: '7 打包', dept: '生产' },
    { value: '行政', label: '8 行政', dept: '行政' },
    { value: '财务', label: '9 财务', dept: '财务' },
    { value: '销售', label: '10 销售', dept: '销售' },
    { value: '仓库发货', label: '11 仓库发货', dept: '仓储' },
    { value: '普工', label: '12 普工', dept: '其他' },
  ];
  
  // 生产商岗位角色
  const ERP_ROLES = DEALER_ROLES;
  
  // 材料商岗位角色
  const MATERIAL_SUPPLIER_ROLES = DEALER_ROLES;
  
  // 加载已有设置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/settings/load');
        const data = await response.json();
        if (data.success) {
          if (data.settings) {
            if (data.settings.order_prefix) setPrefix(data.settings.order_prefix);
            if (data.settings.company_name) setCompanyName(data.settings.company_name);
            if (data.settings.company_phone) setPhone(data.settings.company_phone);
            if (data.settings.company_address) setAddress(data.settings.company_address);
          }
          if (data.isAdmin !== undefined) setIsAdmin(data.isAdmin);
          if (data.prefixes) setPrefixes(data.prefixes);
        }
      } catch (error) {
        console.error('加载设置失败:', error);
      }
    };
    loadSettings();
  }, []);

  // 获取用户列表
  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const response = await fetch('/api/settings/users');
      const data = await response.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // 打开编辑弹窗
  const handleEditUser = (user: typeof users[0]) => {
    setEditingUser(user);
    setEditForm({ name: user.name || '', role: user.role, status: user.status, department: user.department || '' });
    setEditUserOpen(true);
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingUser) return;
    
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/settings/users?id=${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      const data = await response.json();
      if (data.success) {
        setEditUserOpen(false);
        setEditingUser(null);
        fetchUsers();
      } else {
        alert(data.error || '更新失败');
      }
    } catch (error) {
      console.error('更新失败:', error);
      alert('更新失败');
    } finally {
      setIsUpdating(false);
    }
  };

  // 切换用户状态
  const handleToggleStatus = (user: typeof users[0]) => {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    
    fetch(`/api/settings/users?id=${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        fetchUsers();
      } else {
        alert(data.error || '状态更新失败');
      }
    })
    .catch(error => {
      console.error('状态更新失败:', error);
      alert('状态更新失败');
    });
  };

  // 删除用户
  const handleDeleteUser = () => {
    if (!editingUser) return;
    
    const confirmed = window.confirm(`确定要删除用户 "${editingUser.name || editingUser.phone}" 吗？此操作不可恢复。`);
    if (!confirmed) {
      return;
    }
    
    setIsDeleting(true);
    fetch(`/api/settings/users?id=${editingUser.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setEditUserOpen(false);
        setEditingUser(null);
        fetchUsers();
      } else {
        alert(data.error || '删除失败');
      }
    })
    .catch(error => {
      console.error('删除失败:', error);
      alert('删除失败');
    })
    .finally(() => {
      setIsDeleting(false);
    });
  };

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
          name: newUserName || newUserPhone,
          role: newUserRole,
          department: newUserDept
        })
      });
      const data = await response.json();
      if (data.success) {
        setAddUserOpen(false);
        setNewUserPhone('');
        setNewUserName('');
        setNewUserPassword('');
        setNewUserRole('订单管理');
        fetchUsers();
      } else {
        alert(data.error || '添加用户失败');
      }
    } catch (error) {
      console.error('添加用户失败:', error);
      alert('添加用户失败');
    } finally {
      setIsAddingUser(false);
    }
  };

  // Tab切换时加载用户列表
  useEffect(() => {
    const handleTabChange = () => {
      const activeTab = document.querySelector('[data-state="active"]');
      if (activeTab?.textContent === '用户管理') {
        fetchUsers();
      }
    };
    
    // 监听tabs变化
    const observer = new MutationObserver(handleTabChange);
    const tabsList = document.querySelector('[role="tablist"]');
    if (tabsList) {
      observer.observe(tabsList, { childList: true, subtree: true });
    }
    
    // 初始检查
    handleTabChange();
    
    // 也直接设置一个定时器确保用户列表被加载
    const timer = setTimeout(() => {
      fetchUsers();
    }, 100);
    
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, []);

  const handleVerifyPrefix = async () => {
    if (!prefix.trim()) {
      setVerifyResult({ available: false, message: '请输入前缀' });
      return;
    }
    
    setIsVerifying(true);
    setVerifyResult(null);
    
    try {
      const response = await fetch(`/api/settings/verify-prefix?prefix=${encodeURIComponent(prefix)}`);
      const data = await response.json();
      
      if (data.success) {
        setVerifyResult({
          available: data.available,
          message: data.message
        });
      } else {
        setVerifyResult({ available: false, message: data.error || '验证失败' });
      }
    } catch (error) {
      setVerifyResult({ available: false, message: '验证请求失败' });
    } finally {
      setIsVerifying(false);
    }
  };
  
  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    
    try {
      // 调用新的verify-prefix API保存前缀
      const response = await fetch('/api/settings/verify-prefix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix, companyName, phone, address })
      });
      const data = await response.json();
      
      if (data.success) {
        setSaveMessage({ type: 'success', message: '设置保存成功' });
        // 重新加载前缀列表
        const loadResponse = await fetch('/api/settings/load');
        const loadData = await loadResponse.json();
        if (loadData.prefixes) setPrefixes(loadData.prefixes);
        // 2秒后清除消息
        setTimeout(() => setSaveMessage(null), 2000);
      } else {
        setSaveMessage({ type: 'error', message: data.error || '保存失败' });
      }
    } catch (error) {
      setSaveMessage({ type: 'error', message: '保存请求失败' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">系统设置</h1>
            <p className="text-muted-foreground mt-1">管理系统配置和用户权限</p>
          </div>

          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="profile">基本信息</TabsTrigger>
              <TabsTrigger value="users">用户管理</TabsTrigger>
              <TabsTrigger value="roles">角色权限</TabsTrigger>
              <TabsTrigger value="system">系统配置</TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle>基本信息</CardTitle>
                  <CardDescription>修改系统基本信息设置</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>订单设置（前缀）</Label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Input 
                            value={prefix}
                            onChange={(e) => {
                              setPrefix(e.target.value.toUpperCase());
                              setVerifyResult(null);
                            }}
                            placeholder="可编辑，如: QYD、ORD" 
                            className="font-mono"
                          />
                        </div>
                        <Button 
                          variant="outline" 
                          onClick={handleVerifyPrefix}
                          disabled={isVerifying}
                          className="whitespace-nowrap"
                        >
                          {isVerifying ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            '验证可用'
                          )}
                        </Button>
                      </div>
                      {verifyResult && (
                        <div className={`flex items-center gap-2 text-sm ${verifyResult.available ? 'text-green-600' : 'text-red-600'}`}>
                          {verifyResult.available ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                          {verifyResult.message}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">格式: 前缀 + 日期(YYYYMMDD) + 序号(01起)</p>
                      <p className="text-xs text-muted-foreground">示例: QYD2026050101</p>
                    </div>
                    <div className="space-y-2">
                      <Label>公司名称</Label>
                      <Input 
                        value={companyName} 
                        onChange={(e) => setCompanyName(e.target.value)} 
                        placeholder="请输入公司名称" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>联系电话</Label>
                      <Input 
                        value={phone} 
                        onChange={(e) => setPhone(e.target.value)} 
                        placeholder="请输入联系电话" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>公司地址</Label>
                      <Input 
                        value={address} 
                        onChange={(e) => setAddress(e.target.value)} 
                        placeholder="请输入公司地址" 
                      />
                    </div>
                  </div>
                  <Separator />
                  <div className="flex justify-end items-center gap-4">
                    {saveMessage && (
                      <span className={`text-sm ${saveMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                        {saveMessage.type === 'success' && <Check className="h-4 w-4 inline mr-1" />}
                        {saveMessage.message}
                      </span>
                    )}
                    {!isAdmin && (
                      <span className="text-sm text-muted-foreground">
                        只有管理员可以修改订单前缀配置
                      </span>
                    )}
                    <Button onClick={handleSaveSettings} disabled={isSaving || !verifyResult?.available || !isAdmin}>
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          保存中...
                        </>
                      ) : (
                        '保存设置'
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>用户管理</CardTitle>
                      <CardDescription>管理系统用户账号</CardDescription>
                    </div>
                    <Button onClick={() => setAddUserOpen(true)}>添加用户</Button>
                    <DraggableDialog 
                      open={addUserOpen} 
                      onOpenChange={setAddUserOpen}
                      title="添加新用户"
                      description="填写用户信息创建新账号"
                    >
                      <div className="space-y-4">
                        {currentUser?.role === 'super_admin' && (
                          <div className="space-y-2">
                            <Label>租户类型</Label>
                            <select 
                              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                              value={newUserTenantType}
                              onChange={(e) => setNewUserTenantType(e.target.value)}
                            >
                              <option value="manufacturer">生产商</option>
                              <option value="dealer">经销商</option>
                              <option value="material_supplier">材料商</option>
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
                              const role = ERP_ROLES.find(r => r.value === e.target.value);
                              if (role) setNewUserDept(role.dept);
                            }}
                          >
                            {ERP_ROLES.map(role => (
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
                      <div className="flex justify-end gap-2 mt-6">
                        <Button variant="outline" onClick={() => setAddUserOpen(false)}>取消</Button>
                        <Button onClick={handleAddUser} disabled={isAddingUser || !newUserPhone || !newUserPassword}>
                          {isAddingUser ? '添加中...' : '添加'}
                        </Button>
                      </div>
                    </DraggableDialog>
                    
                    {/* 编辑用户弹窗 */}
                    <DraggableDialog 
                      open={editUserOpen} 
                      onOpenChange={setEditUserOpen}
                      title="编辑用户"
                      description="修改用户信息"
                    >
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
                            onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>角色</Label>
                          <select 
                            className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                            value={editForm.role}
                            onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                          >
                            {ERP_ROLES.map(role => (
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
                            onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                          >
                            <option value="active">启用</option>
                            <option value="inactive">禁用</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label>部门</Label>
                          <Input 
                            value={(() => {
                              const role = ERP_ROLES.find(r => r.value === editForm.role);
                              return role ? role.dept : editForm.department || '-';
                            })()} 
                            disabled 
                            className="bg-muted" 
                          />
                        </div>
                      </div>
                      <div className="flex justify-between mt-6">
                        <Button 
                          variant="destructive" 
                          onClick={handleDeleteUser} 
                          disabled={isDeleting}
                        >
                          {isDeleting ? '删除中...' : '删除'}
                        </Button>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => setEditUserOpen(false)}>取消</Button>
                          <Button onClick={handleSaveEdit} disabled={isUpdating}>
                            {isUpdating ? '保存中...' : '保存'}
                          </Button>
                        </div>
                      </div>
                    </DraggableDialog>
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
                            <th className="text-left py-3 px-4 font-medium">密码</th>
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
                              <td colSpan={7} className="py-8 text-center text-muted-foreground">暂无用户数据</td>
                            </tr>
                          ) : (
                            users.map((user) => (
                              <tr key={user.id} className="border-b">
                                <td className="py-3 px-4">{user.phone}</td>
                                <td className="py-3 px-4">
                                  <span className="text-muted-foreground">******</span>
                                </td>
                                <td className="py-3 px-4">{user.name || '-'}</td>
                                <td className="py-3 px-4">
                                  {(() => {
                                    const role = ERP_ROLES.find(r => r.value === user.role);
                                    return role ? (
                                      <span className="px-2 py-1 rounded bg-muted text-xs">{role.dept}</span>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    );
                                  })()}
                                </td>
                                <td className="py-3 px-4">{user.role}</td>
                                <td className="py-3 px-4">
                                  <button 
                                    onClick={() => handleToggleStatus(user)}
                                    className={`px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${user.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
                                  >
                                    {user.status === 'active' ? '启用' : '禁用'}
                                  </button>
                                </td>
                                <td className="py-3 px-4">
                                  <Button variant="outline" size="sm" onClick={() => handleEditUser(user)}>编辑</Button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="roles">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>角色权限</CardTitle>
                      <CardDescription>管理用户角色和权限配置</CardDescription>
                    </div>
                    <Button>添加角色</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card className="p-4">
                      <h4 className="font-medium">超级管理员</h4>
                      <p className="text-sm text-muted-foreground mt-1">拥有系统所有权限</p>
                      <div className="mt-3 text-xs text-muted-foreground">3 个用户</div>
                    </Card>
                    <Card className="p-4">
                      <h4 className="font-medium">管理员</h4>
                      <p className="text-sm text-muted-foreground mt-1">拥有大部分管理权限</p>
                      <div className="mt-3 text-xs text-muted-foreground">5 个用户</div>
                    </Card>
                    <Card className="p-4">
                      <h4 className="font-medium">操作员</h4>
                      <p className="text-sm text-muted-foreground mt-1">仅能操作业务功能</p>
                      <div className="mt-3 text-xs text-muted-foreground">10 个用户</div>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="system">
              <Card>
                <CardHeader>
                  <CardTitle>系统配置</CardTitle>
                  <CardDescription>系统运行参数配置</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>数据备份周期</Label>
                      <Input defaultValue="每天" />
                    </div>
                    <div className="space-y-2">
                      <Label>日志保留天数</Label>
                      <Input defaultValue="90" />
                    </div>
                    <div className="space-y-2">
                      <Label>会话超时时间(分钟)</Label>
                      <Input defaultValue="30" />
                    </div>
                    <div className="space-y-2">
                      <Label>密码最小长度</Label>
                      <Input defaultValue="6" />
                    </div>
                  </div>
                  <Separator />
                  <div className="flex justify-end">
                    <Button>保存设置</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
