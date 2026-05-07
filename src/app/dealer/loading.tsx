import { Skeleton } from '@/components/ui/skeleton';
import { Sidebar } from '@/components/sidebar';

export default function DealerLoading() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-6 space-y-6 overflow-auto">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton className="h-8 w-[160px]" />
            <Skeleton className="h-4 w-[240px]" />
          </div>
          <Skeleton className="h-10 w-[120px]" />
        </div>

        <div className="flex gap-3">
          <Skeleton className="h-10 w-[260px]" />
          <Skeleton className="h-10 w-[140px]" />
          <Skeleton className="h-10 w-[80px]" />
          <Skeleton className="h-10 w-[80px]" />
        </div>

        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </main>
    </div>
  );
}
