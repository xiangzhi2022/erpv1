'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EnterpriseOption {
  enterpriseId: string;
  enterpriseName: string;
  enterpriseType: string;
  displayName: string;
}

export default function SelectEnterprisePage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<EnterpriseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/organizations')
      .then(async (response) => {
        const payload = await response.json() as {
          success?: boolean;
          organizations?: EnterpriseOption[];
          error?: { message?: string };
        };
        if (!response.ok || !payload.success) throw new Error(payload.error?.message || '加载企业失败');
        if (active) setOrganizations(payload.organizations ?? []);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : '加载企业失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function choose(enterpriseId: string) {
    setSwitchingId(enterpriseId);
    setError('');
    try {
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enterpriseId, idempotencyKey: crypto.randomUUID() }),
      });
      const payload = await response.json() as {
        success?: boolean;
        redirectTo?: string;
        error?: { message?: string };
      };
      if (!response.ok || !payload.success) throw new Error(payload.error?.message || '切换企业失败');
      router.replace(payload.redirectTo || '/profile');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '切换企业失败');
    } finally {
      setSwitchingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-12">
      <section className="mx-auto w-full max-w-2xl rounded-3xl border bg-white p-7 shadow-sm sm:p-9">
        <Building2 className="h-10 w-10 text-amber-700" />
        <h1 className="mt-4 text-2xl font-semibold">选择企业</h1>
        <p className="mt-2 text-sm text-muted-foreground">你的账号属于多个企业，请选择本次要进入的企业。</p>
        {loading ? <Loader2 className="mx-auto mt-10 h-6 w-6 animate-spin" /> : null}
        {!loading && organizations.length === 0 ? (
          <p className="mt-8 rounded-xl bg-muted p-4 text-sm">没有可用的企业身份，请联系管理员。</p>
        ) : null}
        <div className="mt-7 grid gap-3">
          {organizations.map((organization) => (
            <Button
              key={organization.enterpriseId}
              type="button"
              variant="outline"
              className="h-auto justify-between px-4 py-4 text-left"
              disabled={switchingId !== null}
              onClick={() => choose(organization.enterpriseId)}
            >
              <span>
                <span className="block font-medium">{organization.enterpriseName}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{organization.enterpriseType}</span>
              </span>
              {switchingId === organization.enterpriseId ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            </Button>
          ))}
        </div>
        {error ? <p className="mt-5 text-sm text-destructive" role="alert">{error}</p> : null}
      </section>
    </main>
  );
}
