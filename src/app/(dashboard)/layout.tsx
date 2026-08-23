import { ProtectedAppShell } from '@/components/protected-app-shell';

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ProtectedAppShell title="ERP 管理平台" path="/categories">
      {children}
    </ProtectedAppShell>
  );
}
