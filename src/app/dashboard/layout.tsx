import { ProtectedAppShell } from '@/components/protected-app-shell';

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ProtectedAppShell title={'\u4eea\u8868\u76d8'} path="/dashboard">
      {children}
    </ProtectedAppShell>
  );
}
