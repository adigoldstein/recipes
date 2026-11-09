import { client } from './generated/client.gen';
import type { PhotoUploaded } from './generated/types.gen';
import {
  CSRF_HEADER,
  CSRF_VALUE,
  SAFETY_NET_MS,
  SESSION_EXPIRED_EVENT,
} from './client';

export interface UploadPhotoOptions {
  /** Called with how much of the file was sent so far, from 0 to 1. */
  onProgress?: (fraction: number) => void;
  /** Cancels the upload. The promise then rejects with an `AbortError`. */
  signal?: AbortSignal;
}

/** Returns the error for a failed upload: the API's error body, or just a message. */
function apiError(request: XMLHttpRequest): unknown {
  try {
    return JSON.parse(request.responseText) as unknown;
  } catch {
    return new Error(`Upload failed (${request.status})`);
  }
}

/**
 * Uploads one image to `POST /api/photos` (AD-27) and returns its `photo_key`. No
 * recipe uses the photo yet.
 *
 * It uses `XMLHttpRequest` and not the generated client, because `fetch` cannot
 * report upload progress. It follows the same rules as every other request: same
 * base URL, the CSRF header (AD-6) and the 401 event (AD-21). On failure it rejects
 * with the API error body, so `getErrorCode` can read it.
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
    // A time limit, like every other request (AD-43). The server may still have saved
    // the photo, but that is fine: unused photos are deleted later.
    request.timeout = SAFETY_NET_MS.upload;
    request.addEventListener('timeout', () =>
      reject({ detail: 'The upload took too long', code: 'request_timeout' }),
    );
    request.addEventListener('abort', () =>
      reject(new DOMException('Upload aborted', 'AbortError')),
    );
    signal?.addEventListener('abort', () => request.abort(), { once: true });
    request.send(body);
  });
}
