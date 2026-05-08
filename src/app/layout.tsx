import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '任务管理 | 核心模块联调',
  description: 'Next.js + Supabase 核心模块联调演示 - 完整增删改查',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="zh-CN">
      <body className="antialiased bg-background text-foreground min-h-screen">
        {isDev && process.env.NODE_ENV === 'development' && (
          <div data-inspector />
        )}
        {children}
      </body>
    </html>
  );
}
