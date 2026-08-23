import { ErrorState } from '@/components/error-state';

export default function NotFoundPage() {
  return (
    <ErrorState
      kind="not-found"
      statusCode="404"
      title="页面不存在"
      description="您访问的页面不存在、已被移动，或当前地址有误。"
      primaryAction={{ href: '/', label: '返回首页' }}
    />
  );
}
