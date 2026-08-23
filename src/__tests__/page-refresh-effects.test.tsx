import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OrderSplitPage from '@/app/orders/[id]/split/page';
import ProductionTasksPage from '@/app/production/tasks/page';

const navigation = vi.hoisted(() => ({ orderId: 'order-1' }));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: navigation.orderId }),
}));

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
}

describe('page refresh effects', () => {
  beforeEach(() => {
    navigation.orderId = 'order-1';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads each order id once when the route changes', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const orderId = url.split('/').at(-1) ?? '';
      return jsonResponse({
        success: true,
        data: {
          id: orderId,
          order_no: orderId.toUpperCase(),
          spaces: [{ id: `space-${orderId}`, products: [] }],
        },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const view = render(<OrderSplitPage />);
    await screen.findByText(/ORDER-1/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenLastCalledWith('/api/orders/order-1');

    navigation.orderId = 'order-2';
    view.rerender(<OrderSplitPage />);

    await screen.findByText(/ORDER-2/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith('/api/orders/order-2');
  });

  it('keeps keyword loading manual and sends one request when search is submitted', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith('/api/production/eligible-workers?')) {
        return jsonResponse({ success: true, data: [] });
      }
      return jsonResponse({ success: true, data: [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ProductionTasksPage />);

    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([input]) => (
        String(input).startsWith('/api/production/tasks?')
      ))).toHaveLength(1);
    });

    fireEvent.change(
      screen.getByPlaceholderText('搜索订单号、客户、空间、产品、任务或工人...'),
      { target: { value: 'cabinet' } },
    );
    expect(fetchMock.mock.calls.filter(([input]) => (
      String(input).startsWith('/api/production/tasks?')
    ))).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: '搜索' }));

    await waitFor(() => {
      const taskRequests = fetchMock.mock.calls
        .map(([input]) => String(input))
        .filter((url) => url.startsWith('/api/production/tasks?'));
      expect(taskRequests).toHaveLength(2);
      expect(taskRequests[1]).toContain('keyword=cabinet');
    });
  });
});
