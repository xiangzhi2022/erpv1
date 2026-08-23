import Link from 'next/link';
import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
      <section className="w-full max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm">
        <ShieldX className="mx-auto h-12 w-12 text-amber-700" />
        <h1 className="mt-5 text-2xl font-semibold">没有访问权限</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          当前企业身份没有访问此页面所需的权限，或该企业身份已停用。
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild variant="outline"><Link href="/select-enterprise">切换企业</Link></Button>
          <Button asChild><Link href="/profile">返回个人资料</Link></Button>
        </div>
      </section>
    </main>
  );
}
