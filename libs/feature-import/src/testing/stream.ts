import { HttpResponse } from 'msw';
import type { DraftRecipe, ImportStage } from '@bite-and-board/data-access';

const encoder = new TextEncoder();

/** Builds one SSE block, like the server writes it (AD-40). */
export const sse = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

const ALL_STAGES: ImportStage[] = [
  { name: 'fetch', status: 'skipped' },
  { name: 'extract', status: 'started' },
  { name: 'extract', status: 'done' },
  { name: 'translate', status: 'skipped' },
  { name: 'validate', status: 'started' },
  { name: 'validate', status: 'done' },
  { name: 'convert_units', status: 'started' },
  { name: 'convert_units', status: 'done' },
];

/** Builds an event stream response from these SSE blocks. */
export function streamOf(blocks: string[]) {
  return new HttpResponse(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const block of blocks) controller.enqueue(encoder.encode(block));
        controller.close();
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream' } },
  );
}

/** A successful import: the steps, then the draft. */
export function draftResponse(
  draft: DraftRecipe,
  stages: ImportStage[] = ALL_STAGES,
) {
  return streamOf([
    ...stages.map((stage) => sse('stage', stage)),
    sse('draft', draft),
  ]);
}

/**
 * Errors that the server returns before the stream starts, with a regular HTTP
 * status.
 */
const BEFORE_STREAM = new Set([
  'import_cap_reached',
  'import_text_too_long',
  'provider_unavailable',
]);

/** A failed import: an HTTP error before the stream, or an `error` event inside it. */
export function errorResponse(
  status: number,
  code: string,
  params?: Record<string, string | number>,
) {
  if (BEFORE_STREAM.has(code)) {
    return HttpResponse.json({ detail: code, code, params }, { status });
  }
  return streamOf([
    sse('stage', { name: 'extract', status: 'started' }),
    sse('error', { code, detail: code, params }),
  ]);
}
