import { ErrorState } from '@/components/error-state';

export default function ForbiddenPage() {
  return (
    <ErrorState
      kind="forbidden"
      statusCode="403"
      title="没有访问权限"
      description="当前企业身份没有访问此页面所需的权限，或该企业身份已停用。"
      primaryAction={{ href: '/profile', label: '返回个人资料' }}
      secondaryAction={{ href: '/select-enterprise', label: '切换企业' }}
    />
  );
}
