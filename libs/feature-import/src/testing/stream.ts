import { HttpResponse } from 'msw';
import type { DraftRecipe, ImportStage } from '@bite-and-board/data-access';

const encoder = new TextEncoder();

/** One SSE block, as the server writes it (AD-40). */
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

/** An event stream response made of these SSE blocks. */
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

/** A good import: the stages, then the draft. */
export function draftResponse(
  draft: DraftRecipe,
  stages: ImportStage[] = ALL_STAGES,
) {
  return streamOf([
    ...stages.map((stage) => sse('stage', stage)),
    sse('draft', draft),
  ]);
}

/** Refusals the server makes before the stream starts keep a plain HTTP status. */
const BEFORE_STREAM = new Set([
  'import_cap_reached',
  'import_text_too_long',
  'provider_unavailable',
]);

/** A failed import: an HTTP error before the stream, an `error` event after it. */
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
