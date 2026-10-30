import { client } from '@bite-and-board/data-access';
import { server } from './server';

// The generated client uses relative `/api` URLs, which Node's fetch rejects;
// the page origin gives MSW something to match.
client.setConfig({ baseUrl: window.location.origin });

// jsdom gaps that Radix (the chip row and the unit select) relies on.
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
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => undefined;
Element.prototype.setPointerCapture ??= () => undefined; // sonner, when a toast is pressed
Element.prototype.scrollIntoView ??= () => undefined;
// jsdom has no object URLs; the photo field previews a chosen file with one.
URL.createObjectURL ??= () => 'blob:preview';
URL.revokeObjectURL ??= () => undefined;

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
