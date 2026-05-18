import { ProtectedAppShell } from '@/components/protected-app-shell';

export default function EmployeesLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedAppShell title="员工管理" path="/employees">
      {children}
    </ProtectedAppShell>
  );
}
