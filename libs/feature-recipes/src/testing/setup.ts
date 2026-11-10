import { client } from '@bite-and-board/data-access';
import { server } from './server';
import './viewport';

// The generated client uses relative `/api` URLs, which Node's fetch does not
// accept. So use the page origin as the base URL, and MSW can match it.
client.setConfig({ baseUrl: window.location.origin });

// Browser features that jsdom does not have, but Radix (the chip row and the unit
// select) needs.
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
// sonner needs this when a toast is clicked.
Element.prototype.setPointerCapture ??= () => undefined;
Element.prototype.scrollIntoView ??= () => undefined;
// jsdom has no object URLs. The photo field uses one to preview the chosen file.
URL.createObjectURL ??= () => 'blob:preview';
URL.revokeObjectURL ??= () => undefined;

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
