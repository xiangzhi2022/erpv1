import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '青崖管理系统',
    template: '%s | 青崖管理系统',
  },
  description: 'ERP生产管理系统 - 智能制造 · 高效管理',
  keywords: ['ERP', '生产管理', '订单管理', '智能制造'],
  authors: [{ name: '温州青崖信息科技有限公司' }],
  generator: 'Coze Code',
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
