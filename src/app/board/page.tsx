'use client';

import { Sidebar } from '@/components/sidebar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

const dailyStats = [
  { label: '今日订单', value: 12, change: '+3', trend: 'up' },
  { label: '今日生产', value: 8, change: '+2', trend: 'up' },
  { label: '今日发货', value: 5, change: '-1', trend: 'down' },
  { label: '今日入库', value: 10, change: '+4', trend: 'up' },
];

const weeklyData = [
  { day: '周一', orders: 15, production: 12, shipped: 10 },
  { day: '周二', orders: 18, production: 15, shipped: 12 },
  { day: '周三', orders: 20, production: 18, shipped: 15 },
  { day: '周四', orders: 16, production: 14, shipped: 16 },
  { day: '周五', orders: 22, production: 19, shipped: 18 },
  { day: '周六', orders: 8, production: 10, shipped: 6 },
  { day: '周日', orders: 5, production: 4, shipped: 3 },
];

const deptStats = [
  { dept: '切割车间', progress: 85 },
  { dept: '组装车间', progress: 72 },
  { dept: '喷涂车间', progress: 68 },
  { dept: '包装车间', progress: 90 },
];

export default function BoardPage() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">数字看板</h1>
            <p className="text-muted-foreground mt-1">实时数据监控中心</p>
          </div>

          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            {dailyStats.map((stat) => (
              <Card key={stat.label}>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <div className="flex items-end gap-2 mt-2">
                    <span className="text-3xl font-bold">{stat.value}</span>
                    <span className={`text-sm ${stat.trend === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                      {stat.change}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">总览</TabsTrigger>
              <TabsTrigger value="production">生产</TabsTrigger>
              <TabsTrigger value="quality">质量</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Weekly Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>本周订单趋势</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {weeklyData.map((data) => (
                        <div key={data.day} className="flex items-center gap-4">
                          <span className="w-12 text-sm text-muted-foreground">{data.day}</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs w-16">订单 {data.orders}</span>
                              <Progress value={(data.orders / 25) * 100} className="h-2 flex-1" />
                            </div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs w-16 text-blue-600">生产 {data.production}</span>
                              <Progress value={(data.production / 25) * 100} className="h-2 flex-1 [&>div]:bg-blue-500" />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs w-16 text-green-600">发货 {data.shipped}</span>
                              <Progress value={(data.shipped / 25) * 100} className="h-2 flex-1 [&>div]:bg-green-500" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Department Status */}
                <Card>
                  <CardHeader>
                    <CardTitle>车间生产状态</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {deptStats.map((dept) => (
                        <div key={dept.dept}>
                          <div className="flex justify-between mb-2">
                            <span className="text-sm font-medium">{dept.dept}</span>
                            <span className="text-sm text-muted-foreground">{dept.progress}%</span>
                          </div>
                          <Progress value={dept.progress} className="h-3" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="production">
              <Card>
                <CardHeader>
                  <CardTitle>生产数据详情</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">生产数据统计图表...</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="quality">
              <Card>
                <CardHeader>
                  <CardTitle>质量数据详情</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">质量数据统计图表...</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
