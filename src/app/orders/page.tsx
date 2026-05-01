'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const pendingOrders = [
  { id: '1', dealer: '青崖客户', order: '青崖项目1-2-2004', date: '2022-10-15 14:14' },
];

const returnedOrders = [
  { id: '1', dealer: '青崖客户', order: '青崖项目1-2-2004', orderDate: '2022-10-15 14:14', returnDate: '2022-10-20 9:20', handler: '账号3名称' },
];

const receivedOrders = [
  { id: '1', dealer: '青崖客户', order: '青崖项目1-2-2004', date: '2022-10-15 14:14', checker: '账号2名称' },
  { id: '2', dealer: '青崖客户', order: '青崖项目1-2-2005', date: '2022-10-16 14:14', checker: '账号1名称' },
  { id: '3', dealer: '青崖客户', order: '青崖项目1-2-201', date: '2022-10-17 15:17', checker: '账号2名称' },
];

const poolOrders = [
  { id: '20221019009', dealer: '青崖客户', order: '青崖项目1-2-2004', date: '2022-10-15 14:14', checker: '账号2名称',录入员: '账号1名称，账号4名称' },
  { id: '20221019008', dealer: '青崖客户', order: '青崖项目1-2-2005', date: '2022-10-16 14:14', checker: '账号1名称',录入员: '账号3名称' },
  { id: '20221019004', dealer: '青崖客户', order: '青崖项目1-2-201', date: '2022-10-17 15:17', checker: '账号2名称',录入员: '账号4名称' },
  { id: '20221019003', dealer: '青崖客户', order: '青崖项目1-2-201', date: '2022-10-19 9:11', checker: '账号4名称',录入员: '账号2名称' },
  { id: '20221019002', dealer: '青崖客户', order: '青崖项目1-2-201', date: '2022-10-20 8:33', checker: '账号1名称',录入员: '账号1名称' },
  { id: '20221019001', dealer: '青崖客户', order: '青崖项目1-2-201', date: '2022-10-20 13:17', checker: '账号3名称',录入员: '账号2名称' },
];

export default function OrdersPage() {
  const [dealerName, setDealerName] = useState('');
  const [orderName, setOrderName] = useState('');
  const [orderPrefix, setOrderPrefix] = useState('QYD');
  const [generatedOrderNo, setGeneratedOrderNo] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // 生成订单号
  const generateOrderNo = async () => {
    setIsGenerating(true);
    try {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const response = await fetch(`/api/orders/sequence?prefix=${orderPrefix}&date=${dateStr}`);
      const data = await response.json();
      if (data.success) {
        setGeneratedOrderNo(data.orderNo);
      } else {
        // 如果API失败，使用本地计算
        setGeneratedOrderNo(`${orderPrefix}${dateStr}01`);
      }
    } catch {
      // 离线模式下使用本地计算
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      setGeneratedOrderNo(`${orderPrefix}${dateStr}01`);
    }
    setIsGenerating(false);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">订单管理</h1>
            <p className="text-muted-foreground mt-1">管理生产订单的接收、录入和状态跟踪</p>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="receive" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6 h-auto p-1 bg-muted">
              <TabsTrigger value="receive">订单接收</TabsTrigger>
              <TabsTrigger value="pending">待接收订单</TabsTrigger>
              <TabsTrigger value="returned">已退回订单</TabsTrigger>
              <TabsTrigger value="received">已接收订单</TabsTrigger>
              <TabsTrigger value="entry">订单录入</TabsTrigger>
              <TabsTrigger value="pool">未排产订单池</TabsTrigger>
            </TabsList>

            {/* 订单接收 Tab */}
            <TabsContent value="receive">
              <Card>
                <CardHeader>
                  <CardTitle>订单接收</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3 mb-6">
                    <div className="space-y-2">
                      <Label>经销商名称</Label>
                      <Input placeholder="请输入经销商名称" value={dealerName} onChange={(e) => setDealerName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>下单日期</Label>
                      <div className="flex gap-2">
                        <Input type="date" />
                        <span className="self-center">至</span>
                        <Input type="date" />
                      </div>
                    </div>
                    <div className="flex items-end">
                      <Button>搜索</Button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium">序号</th>
                          <th className="text-left py-3 px-4 font-medium">经销商名称</th>
                          <th className="text-left py-3 px-4 font-medium">订单名称</th>
                          <th className="text-left py-3 px-4 font-medium">下单日期</th>
                          <th className="text-left py-3 px-4 font-medium">备注</th>
                          <th className="text-left py-3 px-4 font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingOrders.map((order, index) => (
                          <tr key={order.id} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-4">{index + 1}</td>
                            <td className="py-3 px-4">{order.dealer}</td>
                            <td className="py-3 px-4">{order.order}</td>
                            <td className="py-3 px-4 text-muted-foreground">{order.date}</td>
                            <td className="py-3 px-4"></td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm">查看</Button>
                                <Button size="sm">接收</Button>
                                <Button variant="destructive" size="sm">退回</Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">当前显示 1 到 1 条，共 1 条记录</p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled>第一页</Button>
                      <Button variant="outline" size="sm" disabled>上一页</Button>
                      <Button variant="secondary" size="sm">1</Button>
                      <Button variant="outline" size="sm" disabled>下一页</Button>
                      <Button variant="outline" size="sm" disabled>最后一页</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 待接收订单 Tab */}
            <TabsContent value="pending">
              <Card>
                <CardHeader>
                  <CardTitle>待接收订单</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3 mb-6">
                    <div className="space-y-2">
                      <Label>经销商名称</Label>
                      <Input placeholder="请输入经销商名称" />
                    </div>
                    <div className="space-y-2">
                      <Label>下单日期</Label>
                      <div className="flex gap-2">
                        <Input type="date" />
                        <span className="self-center">至</span>
                        <Input type="date" />
                      </div>
                    </div>
                    <div className="flex items-end">
                      <Button>搜索</Button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium">序号</th>
                          <th className="text-left py-3 px-4 font-medium">经销商名称</th>
                          <th className="text-left py-3 px-4 font-medium">订单名称</th>
                          <th className="text-left py-3 px-4 font-medium">下单日期</th>
                          <th className="text-left py-3 px-4 font-medium">备注</th>
                          <th className="text-left py-3 px-4 font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingOrders.map((order, index) => (
                          <tr key={order.id} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-4">{index + 1}</td>
                            <td className="py-3 px-4">{order.dealer}</td>
                            <td className="py-3 px-4">{order.order}</td>
                            <td className="py-3 px-4 text-muted-foreground">{order.date}</td>
                            <td className="py-3 px-4"></td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm">查看</Button>
                                <Button size="sm">接收</Button>
                                <Button variant="destructive" size="sm">退回</Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">当前显示 1 到 1 条，共 1 条记录</p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled>第一页</Button>
                      <Button variant="outline" size="sm" disabled>上一页</Button>
                      <Button variant="secondary" size="sm">1</Button>
                      <Button variant="outline" size="sm" disabled>下一页</Button>
                      <Button variant="outline" size="sm" disabled>最后一页</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 已退回订单 Tab */}
            <TabsContent value="returned">
              <Card>
                <CardHeader>
                  <CardTitle>已退回订单</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3 mb-6">
                    <div className="space-y-2">
                      <Label>经销商名称</Label>
                      <Input placeholder="请输入经销商名称" />
                    </div>
                    <div className="space-y-2">
                      <Label>下单日期</Label>
                      <div className="flex gap-2">
                        <Input type="date" />
                        <span className="self-center">至</span>
                        <Input type="date" />
                      </div>
                    </div>
                    <div className="flex items-end">
                      <Button>搜索</Button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium">序号</th>
                          <th className="text-left py-3 px-4 font-medium">经销商名称</th>
                          <th className="text-left py-3 px-4 font-medium">订单名称</th>
                          <th className="text-left py-3 px-4 font-medium">下单日期</th>
                          <th className="text-left py-3 px-4 font-medium">退回日期</th>
                          <th className="text-left py-3 px-4 font-medium">备注</th>
                          <th className="text-left py-3 px-4 font-medium">退回经手人</th>
                          <th className="text-left py-3 px-4 font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {returnedOrders.map((order, index) => (
                          <tr key={order.id} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-4">{index + 1}</td>
                            <td className="py-3 px-4">{order.dealer}</td>
                            <td className="py-3 px-4">{order.order}</td>
                            <td className="py-3 px-4 text-muted-foreground">{order.orderDate}</td>
                            <td className="py-3 px-4 text-muted-foreground">{order.returnDate}</td>
                            <td className="py-3 px-4"></td>
                            <td className="py-3 px-4">{order.handler}</td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm">查看</Button>
                                <Button variant="outline" size="sm">退回原因</Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">当前显示 1 到 1 条，共 1 条记录</p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled>第一页</Button>
                      <Button variant="outline" size="sm" disabled>上一页</Button>
                      <Button variant="secondary" size="sm">1</Button>
                      <Button variant="outline" size="sm" disabled>下一页</Button>
                      <Button variant="outline" size="sm" disabled>最后一页</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 已接收订单 Tab */}
            <TabsContent value="received">
              <Card>
                <CardHeader>
                  <CardTitle>已接收订单</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3 mb-6">
                    <div className="space-y-2">
                      <Label>经销商名称</Label>
                      <Input placeholder="请输入经销商名称" />
                    </div>
                    <div className="space-y-2">
                      <Label>下单日期</Label>
                      <div className="flex gap-2">
                        <Input type="date" />
                        <span className="self-center">至</span>
                        <Input type="date" />
                      </div>
                    </div>
                    <div className="flex items-end">
                      <Button>搜索</Button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium">序号</th>
                          <th className="text-left py-3 px-4 font-medium">经销商名称</th>
                          <th className="text-left py-3 px-4 font-medium">订单名称</th>
                          <th className="text-left py-3 px-4 font-medium">下单日期</th>
                          <th className="text-left py-3 px-4 font-medium">图纸核对接收</th>
                          <th className="text-left py-3 px-4 font-medium">备注</th>
                          <th className="text-left py-3 px-4 font-medium">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {receivedOrders.map((order, index) => (
                          <tr key={order.id} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-4">{index + 1}</td>
                            <td className="py-3 px-4">{order.dealer}</td>
                            <td className="py-3 px-4">{order.order}</td>
                            <td className="py-3 px-4 text-muted-foreground">{order.date}</td>
                            <td className="py-3 px-4">{order.checker}</td>
                            <td className="py-3 px-4"></td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm">查看</Button>
                                <Button variant="destructive" size="sm">退回</Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">当前显示 1 到 3 条，共 3 条记录</p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled>第一页</Button>
                      <Button variant="outline" size="sm" disabled>上一页</Button>
                      <Button variant="secondary" size="sm">1</Button>
                      <Button variant="outline" size="sm" disabled>下一页</Button>
                      <Button variant="outline" size="sm" disabled>最后一页</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 订单录入 Tab */}
            <TabsContent value="entry">
              <Card>
                <CardHeader>
                  <CardTitle>订单录入</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                    <div className="space-y-2">
                      <Label>经销商名称</Label>
                      <Input placeholder="请输入经销商名称" />
                    </div>
                    <div className="space-y-2">
                      <Label>订单名称</Label>
                      <Input placeholder="请输入订单名称" />
                    </div>
                    <div className="space-y-2">
                      <Label>下单日期</Label>
                      <Input type="date" />
                    </div>
                    <div className="space-y-2">
                      <Label>录入员</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="请选择录入员" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">账号1名称</SelectItem>
                          <SelectItem value="2">账号2名称</SelectItem>
                          <SelectItem value="3">账号3名称</SelectItem>
                          <SelectItem value="4">账号4名称</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4 mb-6">
                    <h4 className="font-medium mb-4">录入页面</h4>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-2">
                        <Label>订单设置（前缀）</Label>
                        <div className="flex gap-2">
                          <Input 
                            placeholder="前缀" 
                            value={orderPrefix}
                            onChange={(e) => setOrderPrefix(e.target.value)}
                            className="w-24"
                          />
                          <Button onClick={generateOrderNo} disabled={isGenerating} variant="outline">
                            {isGenerating ? '生成中...' : '生成订单号'}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>订单编号</Label>
                        <Input 
                          placeholder="点击生成订单号" 
                          value={generatedOrderNo}
                          readOnly 
                          className="bg-muted font-mono"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>经销商名称</Label>
                        <Input placeholder="请输入" />
                      </div>
                      <div className="space-y-2">
                        <Label>订单名称</Label>
                        <Input placeholder="请输入" />
                      </div>
                      <div className="space-y-2">
                        <Label>下单日期</Label>
                        <Input type="date" />
                      </div>
                    </div>

                    <div className="mt-6 border-t pt-6">
                      <h4 className="font-medium mb-4">配件信息</h4>
                      <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-6">
                          <div className="space-y-2">
                            <Label>类型</Label>
                            <Select>
                              <SelectTrigger>
                                <SelectValue placeholder="选择类型" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="hardware">五金</SelectItem>
                                <SelectItem value="panel">免漆柜体</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>供应商</Label>
                            <Input placeholder="请输入" />
                          </div>
                          <div className="space-y-2">
                            <Label>下单时间</Label>
                            <Input type="date" />
                          </div>
                          <div className="space-y-2">
                            <Label>下单员</Label>
                            <Input placeholder="请输入" />
                          </div>
                          <div className="space-y-2">
                            <Label>订单目录</Label>
                            <Input type="file" />
                          </div>
                          <div className="flex items-end">
                            <Button variant="outline" size="sm">上传</Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <Button size="lg">保存</Button>
                    <Button variant="outline" size="lg">外协</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 未排产订单池 Tab */}
            <TabsContent value="pool">
              <Card>
                <CardHeader>
                  <CardTitle>未排产订单池</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3 mb-6">
                    <div className="space-y-2">
                      <Label>经销商名称</Label>
                      <Input placeholder="请输入经销商名称" />
                    </div>
                    <div className="space-y-2">
                      <Label>下单日期</Label>
                      <div className="flex gap-2">
                        <Input type="date" />
                        <span className="self-center">至</span>
                        <Input type="date" />
                      </div>
                    </div>
                    <div className="flex items-end">
                      <Button>搜索</Button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-4 font-medium">序号</th>
                          <th className="text-left py-3 px-4 font-medium">订单编号</th>
                          <th className="text-left py-3 px-4 font-medium">经销商名称</th>
                          <th className="text-left py-3 px-4 font-medium">订单名称</th>
                          <th className="text-left py-3 px-4 font-medium">下单日期</th>
                          <th className="text-left py-3 px-4 font-medium">图纸核对接收</th>
                          <th className="text-left py-3 px-4 font-medium">录入员</th>
                          <th className="text-left py-3 px-4 font-medium">备注</th>
                        </tr>
                      </thead>
                      <tbody>
                        {poolOrders.map((order, index) => (
                          <tr key={order.id} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-4">{index + 1}</td>
                            <td className="py-3 px-4">{order.id}</td>
                            <td className="py-3 px-4">{order.dealer}</td>
                            <td className="py-3 px-4">{order.order}</td>
                            <td className="py-3 px-4 text-muted-foreground">{order.date}</td>
                            <td className="py-3 px-4">{order.checker}</td>
                            <td className="py-3 px-4">{order.录入员}</td>
                            <td className="py-3 px-4"></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">当前显示 1 到 6 条，共 6 条记录</p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled>第一页</Button>
                      <Button variant="outline" size="sm" disabled>上一页</Button>
                      <Button variant="secondary" size="sm">1</Button>
                      <Button variant="outline" size="sm" disabled>下一页</Button>
                      <Button variant="outline" size="sm" disabled>最后一页</Button>
                    </div>
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
