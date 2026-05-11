import { ProtectedAppShell } from '@/components/protected-app-shell';

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ProtectedAppShell title={'\u4f9b\u5e94\u5546\u7ba1\u7406'} path="/supplier">
      {children}
    </ProtectedAppShell>
  );
}
