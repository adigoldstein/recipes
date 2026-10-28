import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { ReactNode } from 'react';
import { client } from './generated/client.gen';
import type { Role, SessionUser } from './generated/types.gen';
import { roleAtLeast, useCan } from './session';

const server = setupServer();
beforeAll(() => {
  client.setConfig({ baseUrl: window.location.origin });
  server.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function serveSession(role: Role | null) {
  const user: SessionUser | null = role
    ? { id: 'u1', email: 'a@b.co', name: 'Adi', role }
    : null;
  server.use(http.get('*/api/auth/session', () => HttpResponse.json({ user })));
}

function renderCan(role: Role) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useCan(role), { wrapper });
}

describe('roleAtLeast', () => {
  it.each([
    ['admin', 'admin', true],
    ['admin', 'editor', true],
    ['editor', 'editor', true],
    ['editor', 'admin', false],
  ] as const)('%s holding %s is %s', (held, required, expected) => {
    expect(roleAtLeast(held, required)).toBe(expected);
  });
});

describe('useCan', () => {
  it('says no to a visitor, and before the first answer', async () => {
    serveSession(null);
    const { result } = renderCan('editor');
    expect(result.current).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current).toBe(false);
  });

  it('lets an editor use editor controls only', async () => {
    serveSession('editor');
    const editor = renderCan('editor');
    const admin = renderCan('admin');
    await waitFor(() => expect(editor.result.current).toBe(true));
    expect(admin.result.current).toBe(false);
  });

  it('lets an admin use both', async () => {
    serveSession('admin');
    const editor = renderCan('editor');
    const admin = renderCan('admin');
    await waitFor(() => expect(editor.result.current).toBe(true));
    await waitFor(() => expect(admin.result.current).toBe(true));
  });
});
