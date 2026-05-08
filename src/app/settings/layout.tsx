import { Sidebar } from '@/components/sidebar';
import { SettingsSidebarNav } from './components/sidebar-nav';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-8">
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
    </div>
  );
}
