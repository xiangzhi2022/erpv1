import { ProtectedAppShell } from '@/components/protected-app-shell';

export default function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ProtectedAppShell title="ERP ç®¡çå¹³å°" path="/categories">
      {children}
    </ProtectedAppShell>
  );
}
