import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/sidebar';
import { Separator } from '@/components/ui/separator';
import { SettingsSidebarNav } from './components/sidebar-nav';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm font-medium">系统设置</span>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-5xl mx-auto space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">系统设置</h1>
              <p className="text-muted-foreground mt-1">管理您的账号设置和系统配置</p>
            </div>
            <div className="flex flex-col md:flex-row gap-8">
              {/* 左侧导航 */}
              <aside className="w-full md:w-56 shrink-0">
                <div className="sticky top-8 rounded-lg border bg-card p-4">
                  <SettingsSidebarNav />
                </div>
              </aside>
              {/* 右侧内容区域 */}
              <section className="flex-1 min-w-0">
                {children}
              </section>
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
