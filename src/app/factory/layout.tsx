import { ProtectedAppShell } from '@/components/protected-app-shell';

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ProtectedAppShell title={'\u5de5\u5382\u7ba1\u7406'} path="/factory">
      {children}
    </ProtectedAppShell>
  );
}
