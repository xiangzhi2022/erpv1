'use client';

import Link from 'next/link';
import { AlertTriangle, FileQuestion, LogIn, RefreshCw, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ErrorStateKind = 'error' | 'unauthorized' | 'forbidden' | 'not-found';

interface ErrorStateAction {
  href: string;
  label: string;
}

interface ErrorStateProps {
  kind: ErrorStateKind;
  title: string;
  description: string;
  statusCode?: string;
  diagnosticId?: string;
  onRetry?: () => void;
  primaryAction?: ErrorStateAction;
  secondaryAction?: ErrorStateAction;
}

const DIAGNOSTIC_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function safeDiagnosticId(value: string | undefined): string | undefined {
  return value && DIAGNOSTIC_ID_PATTERN.test(value) ? value : undefined;
}

const icons = {
  error: AlertTriangle,
  unauthorized: LogIn,
  forbidden: ShieldX,
  'not-found': FileQuestion,
} as const;

export function ErrorState({
  kind,
  title,
  description,
  statusCode,
  diagnosticId,
  onRetry,
  primaryAction,
  secondaryAction,
}: ErrorStateProps) {
  const Icon = icons[kind];
  const safeId = safeDiagnosticId(diagnosticId);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
      <section className="w-full max-w-md rounded-3xl border bg-white p-8 text-center shadow-sm">
        {statusCode && <p className="text-sm font-semibold tracking-widest text-muted-foreground">{statusCode}</p>}
        <Icon className="mx-auto mt-3 size-12 text-amber-700" aria-hidden="true" />
        <h1 className="mt-5 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        {safeId && (
          <p className="mt-4 break-all font-mono text-xs text-muted-foreground">
            {`错误编号：${safeId}`}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {onRetry && (
            <Button type="button" onClick={onRetry}>
              <RefreshCw aria-hidden="true" />
              重试
            </Button>
          )}
          {primaryAction && (
            <Button asChild>
              <Link href={primaryAction.href}>{primaryAction.label}</Link>
            </Button>
          )}
          {secondaryAction && (
            <Button asChild variant="outline">
              <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
            </Button>
          )}
        </div>
      </section>
    </main>
  );
}
