import { ProtectedAppShell } from '@/components/protected-app-shell';

export default function PerformanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedAppShell title="工人绩效" path="/performance/workers">
      {children}
    </ProtectedAppShell>
  );
}
