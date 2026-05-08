import type { Metadata } from 'next';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/sidebar';
import { Separator } from '@/components/ui/separator';

export const metadata: Metadata = {
  title: '仪表盘',
  description: 'ERP 管理平台 - 仪表盘',
};

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm font-medium">ERP 管理平台</span>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
