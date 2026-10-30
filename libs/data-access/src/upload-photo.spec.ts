import { client } from './generated/client.gen';
import { CSRF_HEADER, CSRF_VALUE, SESSION_EXPIRED_EVENT } from './client';
import { getErrorCode } from './errors';
import { uploadPhoto } from './upload-photo';

type Listener = (event: unknown) => void;

/** A stand-in for XMLHttpRequest that the test drives by hand. */
class FakeRequest {
  static last: FakeRequest;
  method = '';
  url = '';
  headers: Record<string, string> = {};
  body: FormData | null = null;
  status = 0;
  responseText = '';
  aborted = false;
  private listeners: Record<string, Listener[]> = {};
  upload = {
    listeners: [] as Listener[],
    addEventListener: (_type: string, listener: Listener) => {
      this.upload.listeners.push(listener);
    },
  };

  constructor() {
    FakeRequest.last = this;
  }

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  addEventListener(type: string, listener: Listener) {
    (this.listeners[type] ??= []).push(listener);
  }
  send(body: FormData) {
    this.body = body;
  }
  abort() {
    this.aborted = true;
    this.emit('abort');
  }
  emit(type: string, event: unknown = {}) {
    for (const listener of this.listeners[type] ?? []) listener(event);
  }
  progress(loaded: number, total: number, lengthComputable = true) {
    for (const listener of this.upload.listeners) {
      listener({ loaded, total, lengthComputable });
    }
  }
  finish(status: number, body: unknown) {
    this.status = status;
    this.responseText = typeof body === 'string' ? body : JSON.stringify(body);
    this.emit('load');
  }
}

const FILE = new File(['pixels'], 'cake.jpg', { type: 'image/jpeg' });

describe('uploadPhoto', () => {
  beforeEach(() => {
    vi.stubGlobal('XMLHttpRequest', FakeRequest);
    client.setConfig({ baseUrl: 'http://test' });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    client.setConfig({ baseUrl: '' });
  });

  it('posts the file as multipart to /api/photos with the CSRF header', async () => {
    const promise = uploadPhoto(FILE);
    const request = FakeRequest.last;
    expect(request.method).toBe('POST');
    expect(request.url).toBe('http://test/api/photos');
    expect(request.headers[CSRF_HEADER]).toBe(CSRF_VALUE);
    expect((request.body?.get('file') as File).name).toBe('cake.jpg');
    request.finish(201, { photo_key: 'a'.repeat(32) });
    await expect(promise).resolves.toEqual({ photo_key: 'a'.repeat(32) });
  });

  it('reports the share sent, ends on 1, and ignores a size it cannot know', async () => {
    const seen: number[] = [];
    const promise = uploadPhoto(FILE, { onProgress: (n) => seen.push(n) });
    FakeRequest.last.progress(250, 1000);
    FakeRequest.last.progress(10, 0, false);
    FakeRequest.last.progress(1000, 1000);
    FakeRequest.last.finish(201, { photo_key: 'b'.repeat(32) });
    await promise;
    expect(seen).toEqual([0.25, 1, 1]);
  });

  it('works without a progress callback', async () => {
    const promise = uploadPhoto(FILE);
    FakeRequest.last.progress(1, 2);
    FakeRequest.last.finish(201, { photo_key: 'c'.repeat(32) });
    await expect(promise).resolves.toBeTruthy();
  });

  it('rejects with the API error body, which getErrorCode reads', async () => {
    const promise = uploadPhoto(FILE);
    FakeRequest.last.finish(415, {
      detail: 'Only JPEG, PNG and WebP images are accepted',
      code: 'photo_unsupported_type',
    });
    const error = await promise.catch((caught: unknown) => caught);
    expect(getErrorCode(error)).toBe('photo_unsupported_type');
  });

  it('rejects with a plain error when the answer is not JSON', async () => {
    const promise = uploadPhoto(FILE);
    FakeRequest.last.finish(502, '<html>Bad gateway</html>');
    const error = await promise.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(Error);
    expect(getErrorCode(error)).toBeUndefined();
  });

  it('sends the session-expired event on a 401', async () => {
    const heard = vi.fn();
    globalThis.addEventListener(SESSION_EXPIRED_EVENT, heard);
    const promise = uploadPhoto(FILE);
    FakeRequest.last.finish(401, { detail: 'x', code: 'unauthorized' });
    await promise.catch(() => undefined);
    globalThis.removeEventListener(SESSION_EXPIRED_EVENT, heard);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('rejects on a network failure', async () => {
    const promise = uploadPhoto(FILE);
    FakeRequest.last.emit('error');
    await expect(promise).rejects.toThrow('Network error');
  });

  it('aborts when the signal fires', async () => {
    const controller = new AbortController();
    const promise = uploadPhoto(FILE, { signal: controller.signal });
    controller.abort();
    expect(FakeRequest.last.aborted).toBe(true);
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('does not start when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const before = FakeRequest.last;
    await expect(
      uploadPhoto(FILE, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(FakeRequest.last).toBe(before);
  });
});
