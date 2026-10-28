import { client } from './generated/client.gen';
import {
  CSRF_HEADER,
  CSRF_VALUE,
  SESSION_EXPIRED_EVENT,
  configureClient,
} from './client';

describe('configureClient', () => {
  it('sends same-origin credentials and the CSRF header only on non-GET', async () => {
    const seen: Request[] = [];
    configureClient();
    configureClient();
    client.setConfig({
      fetch: async (input: string | Request | URL) => {
        const request = input as Request;
        seen.push(request);
        return new Response('{}', {
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    await client.get({ url: '/api/x', baseUrl: 'http://test' });
    await client.post({ url: '/api/x', baseUrl: 'http://test' });

    expect(seen[0].headers.get(CSRF_HEADER)).toBeNull();
    expect(seen[1].headers.get(CSRF_HEADER)).toBe(CSRF_VALUE);
    expect(seen[0].credentials).toBe('same-origin');
    expect(client.getConfig().credentials).toBe('same-origin');
  });
});

describe('the 401 interceptor', () => {
  function answerWith(status: number) {
    configureClient();
    client.setConfig({
      fetch: async () =>
        new Response('{}', {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
    });
  }

  function countExpiries() {
    const handler = vi.fn();
    globalThis.addEventListener(SESSION_EXPIRED_EVENT, handler);
    return {
      handler,
      stop: () =>
        globalThis.removeEventListener(SESSION_EXPIRED_EVENT, handler),
    };
  }

  it('announces an expired session on a 401 from a protected call', async () => {
    answerWith(401);
    const { handler, stop } = countExpiries();
    await client.post({ url: '/api/recipes', baseUrl: 'http://test' });
    stop();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('stays quiet for a login attempt, even a 401', async () => {
    answerWith(401);
    const { handler, stop } = countExpiries();
    await client.post({ url: '/api/auth/login', baseUrl: 'http://test' });
    stop();
    expect(handler).not.toHaveBeenCalled();
  });

  it.each([200, 400, 403, 404, 500])('stays quiet for a %i', async (status) => {
    answerWith(status);
    const { handler, stop } = countExpiries();
    await client.post({ url: '/api/recipes', baseUrl: 'http://test' });
    stop();
    expect(handler).not.toHaveBeenCalled();
  });
});
