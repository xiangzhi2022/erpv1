import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '青崖 ERP',
    template: '%s | 青崖 ERP',
  },
  description: '青崖全屋定制 ERP，统一管理订单、生产、人员、财务与供应链。',
  keywords: [
    '青崖 ERP',
    '全屋定制',
    '订单管理',
    '生产管理',
    '供应链',
  ],
  authors: [{ name: '青崖 ERP Team' }],
  generator: 'Next.js',
  openGraph: {
    title: '青崖 ERP',
    description: '全屋定制企业的一体化订单与生产管理平台。',
    siteName: '青崖 ERP',
    locale: 'zh_CN',
    type: 'website',
  },
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
  const isDev = process.env.NODE_ENV !== 'production';

  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
