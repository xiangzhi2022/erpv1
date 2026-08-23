import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ErrorPage from '@/app/error';
import GlobalError from '@/app/global-error';
import NotFoundPage from '@/app/not-found';
import UnauthorizedPage from '@/app/401/page';
import ForbiddenPage from '@/app/403/page';

afterEach(cleanup);

function sensitiveError(digest?: string): Error & { digest?: string; cause?: unknown } {
  const error = new Error('SUPABASE_SECRET_KEY=do-not-render') as Error & {
    digest?: string;
    cause?: unknown;
  };
  error.stack = 'database stack with postgres://secret';
  error.cause = { password: 'hidden-password' };
  error.digest = digest;
  return error;
}

describe('application error pages', () => {
  it('keeps both runtime error boundaries as client components', () => {
    for (const file of ['src/app/error.tsx', 'src/app/global-error.tsx']) {
      const source = readFileSync(file, 'utf8');
      expect(source.trimStart().startsWith("'use client';")).toBe(true);
    }
  });

  it('shows a generic error, a safe digest, and an accessible retry action', () => {
    const reset = vi.fn();
    render(<ErrorPage error={sensitiveError('safe.digest-123')} reset={reset} />);

    expect(screen.getByRole('heading', { name: '页面暂时无法显示' })).toBeInTheDocument();
    expect(screen.getByText('错误编号：safe.digest-123')).toBeInTheDocument();
    expect(screen.queryByText(/SUPABASE_SECRET_KEY|postgres|hidden-password/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('does not render an unsafe or oversized digest', () => {
    const { rerender } = render(
      <ErrorPage error={sensitiveError('<script>alert(1)</script>')} reset={vi.fn()} />,
    );
    expect(screen.queryByText(/错误编号/)).not.toBeInTheDocument();

    rerender(<ErrorPage error={sensitiveError('a'.repeat(129))} reset={vi.fn()} />);
    expect(screen.queryByText(/错误编号/)).not.toBeInTheDocument();
  });

  it('renders the global fallback with its own document and no sensitive details', () => {
    const markup = renderToStaticMarkup(
      <GlobalError error={sensitiveError('global.digest-1')} reset={vi.fn()} />,
    );

    expect(markup).toContain('<html lang="zh-CN">');
    expect(markup).toContain('<body');
    expect(markup).toContain('应用暂时无法使用');
    expect(markup).toContain('错误编号：global.digest-1');
    expect(markup).not.toMatch(/SUPABASE_SECRET_KEY|postgres|hidden-password/);
  });

  it('provides deterministic navigation for 401, 403, and not-found states', () => {
    const { unmount } = render(<UnauthorizedPage />);
    expect(screen.getByRole('heading', { name: '需要登录' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回登录' })).toHaveAttribute('href', '/login');
    unmount();

    const forbidden = render(<ForbiddenPage />);
    expect(screen.getByRole('heading', { name: '没有访问权限' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '切换企业' })).toHaveAttribute('href', '/select-enterprise');
    expect(screen.getByRole('link', { name: '返回个人资料' })).toHaveAttribute('href', '/profile');
    forbidden.unmount();

    render(<NotFoundPage />);
    expect(screen.getByRole('heading', { name: '页面不存在' })).toBeInTheDocument();
    expect(screen.getByText('404')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回首页' })).toHaveAttribute('href', '/');
  });
});
