import { ProtectedAppShell } from '@/components/protected-app-shell';

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ProtectedAppShell title="ä»»å¡ç®¡ç" path="/tasks">
      {children}
    </ProtectedAppShell>
  );
}
