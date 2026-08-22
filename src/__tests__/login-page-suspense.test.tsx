import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const pendingSearchParams = new Promise<never>(() => undefined);

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => {
    throw pendingSearchParams;
  },
}));

import LoginPage from '@/app/login/page';
import ResetPasswordPage from '@/app/reset-password/page';
import OrdersPage from '@/app/orders/page';
import DealerPage from '@/app/dealer/page';

describe('LoginPage', () => {
  it('shows a loading status while URL search parameters are unavailable', () => {
    render(<LoginPage />);

    expect(screen.getByRole('status', { name: '登录页面加载中' })).toBeInTheDocument();
  });
});

describe('pages that read URL search parameters', () => {
  it('shows a loading status while reset-password search parameters are unavailable', () => {
    render(<ResetPasswordPage />);

    expect(screen.getByRole('status', { name: '重置密码页面加载中' })).toBeInTheDocument();
  });

  it('shows a loading status while order search parameters are unavailable', () => {
    render(<OrdersPage />);

    expect(screen.getByRole('status', { name: '订单页面加载中' })).toBeInTheDocument();
  });

  it('shows a loading status while dealer search parameters are unavailable', () => {
    render(<DealerPage />);

    expect(screen.getByRole('status', { name: '经销商页面加载中' })).toBeInTheDocument();
  });
});
