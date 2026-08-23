import { ErrorState } from '@/components/error-state';

export default function UnauthorizedPage() {
  return (
    <ErrorState
      kind="unauthorized"
      statusCode="401"
      title="需要登录"
      description="您的登录状态已失效，请重新登录后继续。"
      primaryAction={{ href: '/login', label: '返回登录' }}
    />
  );
}
