import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  replace: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: mocks.replace }),
}));
vi.mock('sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
});

describe('onboarding join entry', () => {
  it('lets a verified identity submit a reachable self-service enterprise request', async () => {
    const { default: OnboardingPage } = await import('@/app/onboarding/page');
    render(<OnboardingPage />);
    fireEvent.click(screen.getByRole('button', { name: '加入企业' }));
    fireEvent.change(screen.getByLabelText('企业 ID'), {
      target: { value: '10000000-0000-4000-8000-000000000001' },
    });
    fireEvent.change(screen.getByLabelText('申请说明'), { target: { value: '装配员工' } });
    fireEvent.click(screen.getByRole('button', { name: '提交加入申请' }));

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledWith('/api/organization-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enterprise_id: '10000000-0000-4000-8000-000000000001',
        message: '装配员工',
      }),
    }));
    expect(mocks.toastSuccess).toHaveBeenCalledWith('加入申请已提交，请等待企业管理员审批');
  });
});
