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

export default function SettingsPage() {
  const [prefix, setPrefix] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [verifyResult, setVerifyResult] = useState<{ available: boolean; message: string } | null>(null);
  
  // 用户管理相关状态
  const [users, setUsers] = useState<Array<{id: string; phone: string; nickname: string; role: string; is_active: boolean}>>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  const [isAddingUser, setIsAddingUser] = useState(false);
  
  // 加载已有设置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/settings/load');
        const data = await response.json();
        if (data.success && data.settings) {
          if (data.settings.order_prefix) setPrefix(data.settings.order_prefix);
          if (data.settings.company_name) setCompanyName(data.settings.company_name);
          if (data.settings.company_phone) setPhone(data.settings.company_phone);
          if (data.settings.company_address) setAddress(data.settings.company_address);
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
          role: newUserRole
        })
      });
      const data = await response.json();
      if (data.success) {
        setAddUserOpen(false);
        setNewUserPhone('');
        setNewUserName('');
        setNewUserPassword('');
        setNewUserRole('user');
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
    
    return () => observer.disconnect();
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
      const response = await fetch('/api/settings/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix, companyName, phone, address })
      });
      const data = await response.json();
      
      if (data.success) {
        setSaveMessage({ type: 'success', message: '设置保存成功' });
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
                    <Button onClick={handleSaveSettings} disabled={isSaving || !verifyResult?.available}>
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
                    <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
                      <DialogTrigger asChild>
                        <Button>添加用户</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>添加新用户</DialogTitle>
                          <DialogDescription>填写用户信息创建新账号</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
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
                              onChange={(e) => setNewUserRole(e.target.value)}
                            >
                              <option value="user">普通用户</option>
                              <option value="factory_user">工厂工人</option>
                              <option value="factory_admin">工厂管理员</option>
                              <option value="dealer_admin">经销商管理员</option>
                              <option value="saas_admin">服务商管理员</option>
                              <option value="super_admin">超级管理员</option>
                            </select>
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
                                <td className="py-3 px-4">
                                  <span className="text-muted-foreground">******</span>
                                </td>
                                <td className="py-3 px-4">{user.nickname || '-'}</td>
                                <td className="py-3 px-4">
                                  {user.role === 'super_admin' ? '超级管理员' :
                                   user.role === 'saas_admin' ? '服务商管理员' :
                                   user.role === 'dealer_admin' ? '经销商管理员' :
                                   user.role === 'factory_admin' ? '工厂管理员' :
                                   user.role === 'factory_user' ? '工厂工人' : '普通用户'}
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                    {user.is_active ? '启用' : '禁用'}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <Button variant="outline" size="sm">编辑</Button>
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
