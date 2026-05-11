import { ProtectedAppShell } from '@/components/protected-app-shell';

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ProtectedAppShell title={'\u6570\u5b57\u770b\u677f'} path="/board">
      {children}
    </ProtectedAppShell>
  );
}
