'use client';

import { ErrorState } from '@/components/error-state';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <ErrorState
      kind="error"
      title="页面暂时无法显示"
      description="处理请求时遇到问题，请稍后重试。"
      diagnosticId={error.digest}
      onRetry={reset}
      secondaryAction={{ href: '/', label: '返回首页' }}
    />
  );
}
