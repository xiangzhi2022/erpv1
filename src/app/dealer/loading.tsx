import { Skeleton } from '@/components/ui/skeleton';

export default function DealerLoading() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* 侧边栏骨架 */}
      <div className="w-64 border-r bg-sidebar p-4 space-y-4">
        <Skeleton className="h-8 w-[120px]" />
        <Skeleton className="h-4 w-[80px]" />
        <div className="space-y-2 mt-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>

      {/* 主内容区骨架 */}
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        {/* 标题栏 */}
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton className="h-8 w-[160px]" />
            <Skeleton className="h-4 w-[240px]" />
          </div>
          <Skeleton className="h-10 w-[120px]" />
        </div>

        {/* 搜索栏 */}
        <div className="flex gap-3">
          <Skeleton className="h-10 w-[260px]" />
          <Skeleton className="h-10 w-[140px]" />
          <Skeleton className="h-10 w-[80px]" />
          <Skeleton className="h-10 w-[80px]" />
        </div>

        {/* 表格骨架 */}
        <div className="rounded-md border">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full border-t" />
          ))}
        </div>

        {/* 分页骨架 */}
        <div className="flex justify-between">
          <Skeleton className="h-4 w-[160px]" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-[80px]" />
            <Skeleton className="h-8 w-[80px]" />
          </div>
        </div>
      </main>
    </div>
  );
}
