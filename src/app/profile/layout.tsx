import { ProtectedAppShell } from '@/components/protected-app-shell';

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedAppShell title="个人资料" path="/profile">
      <div className="mx-auto max-w-3xl">{children}</div>
    </ProtectedAppShell>
  );
}
