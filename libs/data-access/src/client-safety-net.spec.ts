import {
  OUTCOME_UNKNOWN_EVENT,
  SAFETY_NET_MS,
  fetchWithSafetyNet,
  safetyNetMs,
} from './client';

const advance = (ms: number) => vi.advanceTimersByTimeAsync(ms);

/** A server that never answers; it only reacts when the request is aborted. */
function hangingFetch() {
  return vi.fn(
    (request: Request) =>
      new Promise<Response>((_resolve, reject) => {
        request.signal.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      }),
  );
}

let outcomeEvents = 0;
const onOutcome = () => (outcomeEvents += 1);

beforeEach(() => {
  vi.useFakeTimers();
  outcomeEvents = 0;
  globalThis.addEventListener(OUTCOME_UNKNOWN_EVENT, onOutcome);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  globalThis.removeEventListener(OUTCOME_UNKNOWN_EVENT, onOutcome);
});

const call = (method: string, path: string) =>
  fetchWithSafetyNet(
    new Request(`http://localhost${path}`, {
      method,
      ...(method === 'GET' ? {} : { body: '{}' }),
    }),
  );

describe('safetyNetMs', () => {
  it('is longer than the server deadline for the same call (AD-43)', () => {
    expect(safetyNetMs('/api/recipes')).toBe(30_000);
    expect(safetyNetMs('/api/photos/limits')).toBe(30_000);
    expect(safetyNetMs('/api/photos')).toBe(120_000);
    expect(safetyNetMs('/api/imports/text')).toBe(95_000);
    // The slowest LLM provider waits 90 s on the server.
    expect(SAFETY_NET_MS.import).toBeGreaterThan(90_000);
  });
});

describe('fetchWithSafetyNet', () => {
  it('passes a normal answer through untouched', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('ok', { status: 200 }))),
    );
    const response = await call('GET', '/api/recipes');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
    expect(outcomeEvents).toBe(0);
  });

  it('answers a slow read with request_timeout after 30 s, without an event', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    const pending = call('GET', '/api/recipes');
    await advance(29_000);
    let settled = false;
    void pending.then(() => (settled = true));
    await advance(0);
    expect(settled).toBe(false);
    await advance(1_500);
    const response = await pending;
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ code: 'request_timeout' });
    expect(outcomeEvents).toBe(0);
  });

  it('says the outcome of a slow write is unknown, and tells the app', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    const pending = call('POST', '/api/recipes');
    await advance(30_500);
    const response = await pending;
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ code: 'outcome_unknown' });
    expect(outcomeEvents).toBe(1);
  });

  it.each(['DELETE', 'PUT', 'PATCH'])(
    'treats a slow %s as a write too',
    async (method) => {
      vi.stubGlobal('fetch', hangingFetch());
      const pending = call(method, '/api/recipes/r1');
      await advance(30_500);
      expect(await (await pending).json()).toMatchObject({
        code: 'outcome_unknown',
      });
    },
  );

  it('waits 95 s for an import and then says it can simply be tried again', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    const pending = call('POST', '/api/imports/text');
    await advance(60_000);
    let settled = false;
    void pending.then(() => (settled = true));
    await advance(0);
    expect(settled).toBe(false);
    await advance(36_000);
    const response = await pending;
    expect(await response.json()).toMatchObject({ code: 'request_timeout' });
    // An import saves nothing, so it is not "unknown".
    expect(outcomeEvents).toBe(0);
  });

  it('lets a real network error through as it is', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    await expect(call('GET', '/api/recipes')).rejects.toThrow(
      'Failed to fetch',
    );
    expect(outcomeEvents).toBe(0);
  });

  it('stops waiting when the caller aborts, and does not report a timeout', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    const controller = new AbortController();
    const pending = fetchWithSafetyNet(
      new Request('http://localhost/api/recipes', {
        signal: controller.signal,
      }),
    );
    controller.abort();
    await expect(pending).rejects.toThrow('aborted');
    expect(outcomeEvents).toBe(0);
  });
});
