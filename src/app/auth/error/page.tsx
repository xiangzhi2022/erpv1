import Link from 'next/link';

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <section className="w-full max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-950">身份验证未完成</h1>
        <p className="mt-3 text-sm text-slate-600">
          验证链接可能已过期或已使用，请返回登录页重新发起。
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-5 text-sm font-medium text-white"
        >
          返回登录
        </Link>
      </section>
    </main>
  );
}
