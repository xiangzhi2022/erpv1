import { ProtectedAppShell } from '@/components/protected-app-shell';

export default function ProductionLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedAppShell title="生产任务" path="/production/tasks">
      {children}
    </ProtectedAppShell>
  );
}
