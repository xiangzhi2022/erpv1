import { redirect } from 'next/navigation';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/sidebar';
import { Separator } from '@/components/ui/separator';
import { getCurrentAuthUser } from '@/lib/auth';
import { canAccessPath, getLandingPath } from '@/lib/role-access';

interface ProtectedAppShellProps {
  children: React.ReactNode;
  title: string;
  path: string;
}

export async function ProtectedAppShell({ children, title, path }: ProtectedAppShellProps) {
  const user = await getCurrentAuthUser();
  if (!user) {
    redirect('/login');
  }

  if (!canAccessPath(user, path)) {
    redirect(`${getLandingPath(user)}?permission=denied`);
  }

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm font-medium">{title}</span>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
