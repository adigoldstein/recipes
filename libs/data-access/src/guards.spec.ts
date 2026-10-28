import { QueryClient } from '@tanstack/react-query';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { client } from './generated/client.gen';
import type { Role, SessionUser } from './generated/types.gen';
import { requireRole } from './guards';

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

async function runGuard(
  role: Role | undefined,
  url = 'http://test/secret?a=1',
) {
  const loader = requireRole(new QueryClient(), role);
  try {
    return await loader({ request: new Request(url) });
  } catch (thrown) {
    return thrown;
  }
}

describe('requireRole', () => {
  it('sends a visitor to /login with the page they wanted', async () => {
    serveSession(null);
    const result = await runGuard(undefined);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);
    expect((result as Response).headers.get('Location')).toBe(
      '/login?next=%2Fsecret%3Fa%3D1',
    );
  });

  it('lets any signed-in user through when no role is asked', async () => {
    serveSession('editor');
    expect(await runGuard(undefined)).toBeNull();
  });

  it('lets an editor into editor areas and an admin into both', async () => {
    serveSession('editor');
    expect(await runGuard('editor')).toBeNull();
    serveSession('admin');
    expect(await runGuard('editor')).toBeNull();
    expect(await runGuard('admin')).toBeNull();
  });

  it('answers an editor on an admin area with not-found', async () => {
    serveSession('editor');
    const result = (await runGuard('admin')) as {
      type: string;
      init: { status: number };
    };
    expect(result.type).toBe('DataWithResponseInit');
    expect(result.init.status).toBe(404);
  });

  it('reuses the cached session instead of asking again', async () => {
    let calls = 0;
    server.use(
      http.get('*/api/auth/session', () => {
        calls += 1;
        return HttpResponse.json({
          user: { id: 'u1', email: 'a@b.co', name: 'Adi', role: 'admin' },
        });
      }),
    );
    const loader = requireRole(new QueryClient(), 'admin');
    await loader({ request: new Request('http://test/x') });
    await loader({ request: new Request('http://test/x') });
    expect(calls).toBe(1);
  });
});
