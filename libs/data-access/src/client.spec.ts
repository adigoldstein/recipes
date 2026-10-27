import { client } from './generated/client.gen';
import { CSRF_HEADER, CSRF_VALUE, configureClient } from './client';

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
