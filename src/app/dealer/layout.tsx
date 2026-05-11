import { ProtectedAppShell } from '@/components/protected-app-shell';

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ProtectedAppShell title={'\u7ecf\u9500\u5546\u7ba1\u7406'} path="/dealer">
      {children}
    </ProtectedAppShell>
  );
}
