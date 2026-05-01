'use client';

import { Sidebar } from '@/components/sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

export default function SettingsPage() {
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
                      <Label>系统名称</Label>
                      <Input defaultValue="某某生产管理系统" />
                    </div>
                    <div className="space-y-2">
                      <Label>公司名称</Label>
                      <Input defaultValue="某某木业有限公司" />
                    </div>
                    <div className="space-y-2">
                      <Label>联系电话</Label>
                      <Input defaultValue="400-888-8888" />
                    </div>
                    <div className="space-y-2">
                      <Label>公司地址</Label>
                      <Input defaultValue="某某省某某市某某区某某路88号" />
                    </div>
                  </div>
                  <Separator />
                  <div className="flex justify-end">
                    <Button>保存设置</Button>
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
                    <Button>添加用户</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium">用户名</th>
                          <th className="text-left py-3 px-4 font-medium">姓名</th>
                          <th className="text-left py-3 px-4 font-medium">角色</th>
                          <th className="text-left py-3 px-4 font-medium">状态</th>
                          <th className="text-left py-3 px-4 font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          <td className="py-3 px-4">admin</td>
                          <td className="py-3 px-4">管理员</td>
                          <td className="py-3 px-4">超级管理员</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">启用</span>
                          </td>
                          <td className="py-3 px-4">
                            <Button variant="outline" size="sm">编辑</Button>
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-3 px-4">user01</td>
                          <td className="py-3 px-4">账号1名称</td>
                          <td className="py-3 px-4">操作员</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">启用</span>
                          </td>
                          <td className="py-3 px-4">
                            <Button variant="outline" size="sm">编辑</Button>
                          </td>
                        </tr>
                        <tr className="border-b">
                          <td className="py-3 px-4">user02</td>
                          <td className="py-3 px-4">账号2名称</td>
                          <td className="py-3 px-4">审核员</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">启用</span>
                          </td>
                          <td className="py-3 px-4">
                            <Button variant="outline" size="sm">编辑</Button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
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
