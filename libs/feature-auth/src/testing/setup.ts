import { client } from '@bite-and-board/data-access';
import { server } from './server';

// The generated client uses relative `/api` URLs, which Node's fetch does not
// accept. So use the page origin as the base URL, and MSW can match it.
client.setConfig({ baseUrl: window.location.origin });

// A browser feature that jsdom does not have, but Radix (the chip row) needs.
class ResizeObserverStub {
  observe() {
    /* no layout in jsdom */
  }
  unobserve() {
    /* no layout in jsdom */
  }
  disconnect() {
    /* no layout in jsdom */
  }
}
globalThis.ResizeObserver ??= ResizeObserverStub;

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
