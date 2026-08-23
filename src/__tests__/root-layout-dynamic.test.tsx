import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connection: vi.fn(),
}));

vi.mock('next/server', () => ({
  connection: mocks.connection,
}));

vi.mock('react-dev-inspector', () => ({
  Inspector: () => null,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('nonce-compatible rendering', () => {
  it('waits for an incoming request before rendering the root layout', async () => {
    let releaseConnection!: () => void;
    mocks.connection.mockReturnValue(new Promise<void>((resolve) => {
      releaseConnection = resolve;
    }));
    const { default: RootLayout } = await import('@/app/layout');

    const rendering = RootLayout({ children: <main>ERP</main> });
    let settled = false;
    Promise.resolve(rendering).then(() => {
      settled = true;
    });
    await Promise.resolve();

    expect(mocks.connection).toHaveBeenCalledOnce();
    expect(settled).toBe(false);

    releaseConnection();
    const rendered = await rendering;
    expect(rendered.type).toBe('html');
  });
});
