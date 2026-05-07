import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Sidebar } from "@/components/sidebar";

export default function WorkshopsLoading() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64">
        <div className="p-6 space-y-6">
          {/* 标题骨架 */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-8 w-40 bg-muted animate-pulse rounded" />
              <div className="h-4 w-64 bg-muted animate-pulse rounded" />
            </div>
            <div className="h-10 w-28 bg-muted animate-pulse rounded-md" />
          </div>

          {/* 统计卡片骨架 */}
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-muted rounded-lg" />
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded w-16" />
                    <div className="h-6 bg-muted rounded w-8" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 过滤栏骨架 */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-72 bg-muted animate-pulse rounded-md" />
            <div className="h-9 w-20 bg-muted animate-pulse rounded-md" />
          </div>

          {/* 卡片骨架 */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-muted rounded-lg" />
                    <div className="space-y-2">
                      <div className="h-4 bg-muted rounded w-24" />
                      <div className="h-3 bg-muted rounded w-16" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-3 bg-muted rounded" />
                    <div className="h-3 bg-muted rounded" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-muted rounded" />
                    <div className="h-2 bg-muted rounded" />
                  </div>
                  <div className="h-3 bg-muted rounded w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
