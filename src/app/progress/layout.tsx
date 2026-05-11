import { ProtectedAppShell } from '@/components/protected-app-shell';

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ProtectedAppShell title="çäº§è¿åº¦" path="/progress">
      {children}
    </ProtectedAppShell>
  );
}
