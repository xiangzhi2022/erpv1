import { ProtectedAppShell } from '@/components/protected-app-shell';

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ProtectedAppShell title="å·¥äººç®¡ç" path="/workers">
      {children}
    </ProtectedAppShell>
  );
}
