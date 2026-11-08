import { client } from './generated/client.gen';
import type { DraftRecipe } from './generated/types.gen';
import {
  CSRF_HEADER,
  CSRF_VALUE,
  SESSION_EXPIRED_EVENT,
  importSafetyNetMs,
} from './client';

/** The real pipeline stages the server reports (AD-40). */
export type ImportStageName =
  'fetch' | 'extract' | 'translate' | 'validate' | 'convert_units';
export type ImportStageStatus = 'started' | 'done' | 'skipped';
export interface ImportStage {
  name: ImportStageName;
  status: ImportStageStatus;
}

export interface StreamImportOptions {
  /** Aborting it is "ביטול": the request is dropped and the server cancels the engine. */
  signal?: AbortSignal;
  onStage?: (stage: ImportStage) => void;
}

interface ServerEvent {
  event: string;
  data: string;
}

/** The API's error body shape, so the UI reads it like any other error (AD-28). */
function apiError(code: string, detail: string, params?: unknown) {
  return { code, detail, ...(params ? { params } : {}) };
}

/** Splits an SSE text buffer into whole events; the rest stays in the buffer. */
function takeEvents(buffer: string): { events: ServerEvent[]; rest: string } {
  const blocks = buffer.split(/\r?\n\r?\n/);
  const rest = blocks.pop() ?? '';
  const events: ServerEvent[] = [];
  for (const block of blocks) {
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
    }
    if (data.length > 0) events.push({ event, data: data.join('\n') });
  }
  return { events, rest };
}

/**
 * Runs an import and reads its progress stream with `fetch` and a stream reader (AD-40;
 * `EventSource` cannot POST or send the CSRF header). Resolves with the draft; a
 * failure throws the API's error shape `{code, detail, params?}`, whether the server
 * refused before the stream (plain HTTP status) or sent an `error` event after it.
 * `onStage` hears each pipeline stage. If the server stays silent longer than the
 * import safety net, the call fails with `request_timeout` (AD-43).
 */
export async function streamImport(
  kind: 'text' | 'url',
  body: { text: string } | { url: string },
  { signal, onStage }: StreamImportOptions = {},
): Promise<DraftRecipe> {
  const controller = new AbortController();
  signal?.addEventListener('abort', () => controller.abort(), { once: true });
  let silent = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const watch = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      silent = true;
      controller.abort();
    }, importSafetyNetMs());
  };

  watch();
  try {
    const base = client.getConfig().baseUrl ?? '';
    const response = await fetch(`${base}/api/imports/${kind}`, {
      method: 'POST',
      credentials: 'same-origin',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        [CSRF_HEADER]: CSRF_VALUE,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok || !response.body) {
      if (response.status === 401) {
        globalThis.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
      throw await response.json().catch(() => apiError('unknown', 'failed'));
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      watch();
      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = takeEvents(buffer);
      buffer = rest;
      for (const { event, data } of events) {
        const payload: unknown = JSON.parse(data);
        if (event === 'stage') onStage?.(payload as ImportStage);
        else if (event === 'draft') return payload as DraftRecipe;
        else if (event === 'error') {
          const failure = payload as {
            code: string;
            detail: string;
            params?: unknown;
          };
          throw apiError(failure.code, failure.detail, failure.params);
        }
      }
    }
    // The stream ended without a draft or an error: the connection was cut.
    throw apiError('request_failed', 'The import stream ended early');
  } catch (error) {
    if (silent) {
      throw apiError('request_timeout', 'The request took too long');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
