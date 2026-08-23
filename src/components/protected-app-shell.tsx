import { redirect } from 'next/navigation';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/sidebar';
import { Separator } from '@/components/ui/separator';
import { getEnterpriseContext } from '@/lib/enterprise/context';
import { isEnterpriseAccessError } from '@/lib/enterprise/errors';
import { canAccessPath } from '@/lib/role-access';

interface ProtectedAppShellProps {
  children: React.ReactNode;
  title: string;
  path: string;
}

export async function ProtectedAppShell({ children, title, path }: ProtectedAppShellProps) {
  let context;
  try {
    context = await getEnterpriseContext();
  } catch (error) {
    if (!isEnterpriseAccessError(error)) throw error;
    if (error.code === 'IDENTITY_REQUIRED') redirect('/login');
    if (error.code === 'ENTERPRISE_SELECTION_REQUIRED') redirect('/select-enterprise');
    if (error.code === 'ENTERPRISE_MEMBERSHIP_REQUIRED') redirect('/onboarding');
    if (error.code === 'ENTERPRISE_ACCESS_FORBIDDEN') redirect('/403');
    throw error;
  }

  const accessSubject = { grants: context.grants, enterpriseType: context.enterpriseType };
  if (!canAccessPath(accessSubject, path)) redirect('/403');

  return (
    <SidebarProvider>
      <AppSidebar context={context} />
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
