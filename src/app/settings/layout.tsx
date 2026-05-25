import { ProtectedAppShell } from '@/components/protected-app-shell';
import { getCurrentAuthUser } from '@/lib/auth';
import { SettingsSidebarNav } from './components/sidebar-nav';

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentAuthUser();

  return (
    <ProtectedAppShell title="系统设置" path="/settings">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">系统设置</h1>
          <p className="text-muted-foreground mt-1">管理您的账号设置和系统配置</p>
        </div>
        <div className="flex flex-col md:flex-row gap-8">
          <aside className="w-full md:w-56 shrink-0">
            <div className="sticky top-8 rounded-lg border bg-card p-4">
              <SettingsSidebarNav user={user} />
            </div>
          </aside>
          <section className="flex-1 min-w-0">{children}</section>
        </div>
      </div>
    </ProtectedAppShell>
  );
}
