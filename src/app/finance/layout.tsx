import { ProtectedAppShell } from '@/components/protected-app-shell';

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ProtectedAppShell title="è´¢å¡ç®¡ç" path="/finance">
      {children}
    </ProtectedAppShell>
  );
}
