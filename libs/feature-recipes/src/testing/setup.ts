import { client } from '@bite-and-board/data-access';
import { server } from './server';

// The generated client uses relative `/api` URLs, which Node's fetch rejects;
// the page origin gives MSW something to match.
client.setConfig({ baseUrl: window.location.origin });

// jsdom gaps that Radix (the chip row) relies on.
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
