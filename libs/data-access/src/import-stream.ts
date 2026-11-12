import { client } from './generated/client.gen';
import type { DraftRecipe } from './generated/types.gen';
import { CSRF_HEADER, CSRF_VALUE, SESSION_EXPIRED_EVENT } from './client';

/** The import steps that the server reports (AD-40). */
export type ImportStageName =
  'fetch' | 'extract' | 'translate' | 'validate' | 'convert_units';
export type ImportStageStatus = 'started' | 'done' | 'skipped';
export interface ImportStage {
  name: ImportStageName;
  status: ImportStageStatus;
}

export interface StreamImportOptions {
  /** Abort it to cancel ("ביטול"): the request stops and the server stops the AI. */
  signal?: AbortSignal;
  onStage?: (stage: ImportStage) => void;
}

interface ServerEvent {
  event: string;
  data: string;
}

/**
 * Builds an error in the API's error shape, so the UI handles it like any other
 * error (AD-28).
 */
function apiError(code: string, detail: string, params?: unknown) {
  return { code, detail, ...(params ? { params } : {}) };
}

/**
 * Takes the complete events out of the SSE text. An incomplete event stays in
 * `rest`.
 */
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
 * Runs an import and reads its progress stream (AD-40). Returns the draft.
 *
 * On failure it throws the API's error shape `{code, detail, params?}`, both when the
 * server refuses before the stream starts and when it sends an `error` event.
 * `onStage` is called for each import step.
 */
export async function streamImport(
  kind: 'text' | 'url',
  body: { text: string } | { url: string },
  { signal, onStage }: StreamImportOptions = {},
): Promise<DraftRecipe> {
  const base = client.getConfig().baseUrl ?? '';
  // We use `fetch` and not `EventSource`, because `EventSource` cannot send a POST
  // or the CSRF header.
  const response = await fetch(`${base}/api/imports/${kind}`, {
    method: 'POST',
    credentials: 'same-origin',
    signal,
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
  // The stream ended without a draft or an error, so the connection was cut.
  throw apiError('request_failed', 'The import stream ended early');
}
