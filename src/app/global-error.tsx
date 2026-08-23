'use client';

import { ErrorState } from '@/components/error-state';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="zh-CN">
      <body>
        <ErrorState
          kind="error"
          title="应用暂时无法使用"
          description="系统遇到意外问题，请稍后重试。"
          diagnosticId={error.digest}
          onRetry={reset}
          secondaryAction={{ href: '/', label: '返回首页' }}
        />
      </body>
    </html>
  );
}
