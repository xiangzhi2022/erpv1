import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateOrderDialog } from '@/app/orders/components/create-order-dialog';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/api/orders/prefix') {
      return Response.json({ success: true, data: { prefix: 'JX' } });
    }
    if (url === '/api/orders/generate') {
      return Response.json({ success: true, data: { order_no: 'JX-0001' } });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('CreateOrderDialog', () => {
  it('keeps the default space selectable in the active structure editor', async () => {
    render(
      <CreateOrderDialog
        open
        mode="dealer_finished"
        partnerLabel="工厂"
        parentOrders={[]}
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(await screen.findByDisplayValue('JX-0001')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /主卧室/ }));

    expect(screen.getByText('结构录入')).toBeInTheDocument();
    expect(screen.getByDisplayValue('主卧室')).toBeInTheDocument();
  });
});
