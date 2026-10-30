import { client } from './generated/client.gen';
import type { PhotoUploaded } from './generated/types.gen';
import { CSRF_HEADER, CSRF_VALUE, SESSION_EXPIRED_EVENT } from './client';

export interface UploadPhotoOptions {
  /** Called with the share of the file sent so far, from 0 to 1. */
  onProgress?: (fraction: number) => void;
  /** Aborts the upload; the returned promise then rejects with an `AbortError`. */
  signal?: AbortSignal;
}

/** What a failed upload rejects with: the API's error body, or just a message. */
function apiError(request: XMLHttpRequest): unknown {
  try {
    return JSON.parse(request.responseText) as unknown;
  } catch {
    return new Error(`Upload failed (${request.status})`);
  }
}

/**
 * Sends one image to `POST /api/photos` (AD-27) and resolves with its unattached
 * `photo_key`. It uses `XMLHttpRequest`, not the generated client: `fetch` cannot
 * report how much of an upload has been sent. It still goes through the same rules as
 * every other call: the same origin and base URL, the CSRF header (AD-6) and the one
 * 401 event (AD-21). A failure rejects with the API error body, so `getErrorCode`
 * reads it like any other.
 */
export function uploadPhoto(
  file: File,
  { onProgress, signal }: UploadPhotoOptions = {},
): Promise<PhotoUploaded> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Upload aborted', 'AbortError'));
      return;
    }
    const request = new XMLHttpRequest();
    const body = new FormData();
    body.append('file', file);

    request.open('POST', `${client.getConfig().baseUrl ?? ''}/api/photos`);
    request.setRequestHeader(CSRF_HEADER, CSRF_VALUE);
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    });
    request.addEventListener('load', () => {
      if (request.status === 401) {
        globalThis.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(1);
        resolve(JSON.parse(request.responseText) as PhotoUploaded);
      } else {
        reject(apiError(request));
      }
    });
    request.addEventListener('error', () =>
      reject(new Error('Network error during upload')),
    );
    request.addEventListener('abort', () =>
      reject(new DOMException('Upload aborted', 'AbortError')),
    );
    signal?.addEventListener('abort', () => request.abort(), { once: true });
    request.send(body);
  });
}
