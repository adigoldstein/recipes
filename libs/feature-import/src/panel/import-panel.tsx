import { useRef, useState } from 'react';
import {
  Check,
  ClipboardPaste,
  Link,
  LoaderCircle,
  RotateCw,
  Sparkles,
  X,
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getErrorCode,
  streamImport,
  type DraftRecipe,
  type ImportStage,
  type ImportStageName,
  type ImportStageStatus,
} from '@bite-and-board/data-access';
import {
  Button,
  ConfirmDialog,
  FormField,
  Input,
  PendingButton,
  SLOW_AFTER_LONG_MS,
  SlowNote,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
} from '@bite-and-board/ui-components';
import { useErrorMessage } from '../shared/use-error-message';

type Mode = 'url' | 'text';

/** The import steps, in the order the checklist shows them (AD-40). */
const STAGES: ImportStageName[] = [
  'fetch',
  'extract',
  'translate',
  'validate',
  'convert_units',
];

type Progress = Partial<Record<ImportStageName, ImportStageStatus>>;

/** Download errors where the solution is to paste the page's text (AD-35). */
const FETCH_ERRORS = new Set([
  'fetch_blocked',
  'fetch_challenged',
  'fetch_failed',
  'fetch_too_large',
]);

/**
 * Errors where the AI engine failed (or took too long), and the solution is to try
 * again.
 */
const ENGINE_ERRORS = new Set([
  'llm_timeout',
  'llm_unavailable',
  'llm_quota',
  'llm_invalid_output',
  'provider_unavailable',
  'request_failed',
  'internal_error',
]);

/** Checks that a link is one the server can try: http or https only. */
function isWebLink(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * What the page that shows the panel gives it. The two libraries do not import each
 * other.
 */
export interface ImportPanelProps {
  /** True if the form has text the editor typed, so an import would replace it. */
  dirty: boolean;
  /**
   * Called with the draft when the import succeeds. The page puts it in its form
   * (AD-22).
   */
  onDraft: (draft: DraftRecipe) => void;
  /** Called when a request starts or ends, so the page can lock its form meanwhile. */
  onBusyChange: (busy: boolean) => void;
}

/**
 * "ייבוא עם בינה מלאכותית" at the top of the new recipe page (FR-17, FR-18). A button
 * opens a panel with two options: "קישור" (a link to a recipe page, Story 5.4) and
 * "הדבקת טקסט".
 *
 * While the import runs, the page locks its form. When it ends, the form is filled
 * with the draft, and nothing is saved until the editor presses "שמירה". If it fails,
 * the form and the input stay as they were. If a page cannot be downloaded, one click
 * switches to pasting its text.
 */
export function ImportPanel({
  dirty,
  onDraft,
  onBusyChange,
}: ImportPanelProps) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const importDraft = useMutation({
    mutationFn: (request: {
      kind: Mode;
      body: { text: string } | { url: string };
      signal: AbortSignal;
      onStage: (stage: ImportStage) => void;
    }) =>
      streamImport(request.kind, request.body, {
        signal: request.signal,
        onStage: request.onStage,
      }),
  });
  const [progress, setProgress] = useState<Progress>({});
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('url');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [problem, setProblem] = useState<string>();
  const [offerText, setOfferText] = useState(false);
  const [done, setDone] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  // The running request. "ביטול" works by aborting it.
  const running = useRef<AbortController>(undefined);
  const pending = importDraft.isPending;

  const callbacks = {
    onSuccess: (draft: DraftRecipe) => {
      if (running.current?.signal.aborted) return;
      onDraft(draft);
      setText('');
      setUrl('');
      setOpen(false);
      setDone(true);
    },
    onError: (error: unknown) => {
      // A cancel is not an error: show no message, and keep the form as it was.
      if (running.current?.signal.aborted) return;
      const code = getErrorCode(error) ?? '';
      setProblem(errorMessage(error));
      setCanRetry(ENGINE_ERRORS.has(code));
      setOfferText(
        FETCH_ERRORS.has(code) || (mode === 'url' && ENGINE_ERRORS.has(code)),
      );
    },
    onSettled: () => {
      if (!running.current?.signal.aborted) onBusyChange(false);
    },
  };

  const cancel = () => {
    running.current?.abort();
    importDraft.reset();
    setProgress({});
    onBusyChange(false);
  };

  const run = () => {
    setConfirming(false);
    setProblem(undefined);
    setOfferText(false);
    setCanRetry(false);
    setDone(false);
    setProgress({});
    onBusyChange(true);
    const controller = new AbortController();
    running.current = controller;
    const signal = controller.signal;
    const onStage = ({ name, status }: ImportStage) => {
      if (!signal.aborted) setProgress((now) => ({ ...now, [name]: status }));
    };
    importDraft.mutate(
      {
        kind: mode,
        body: mode === 'url' ? { url: url.trim() } : { text },
        signal,
        onStage,
      },
      callbacks,
    );
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setProblem(undefined);
    setOfferText(false);
    setCanRetry(false);
  };

  const check = (): string | undefined => {
    if (mode === 'text') {
      return text.trim() ? undefined : t('import.text.required');
    }
    if (!url.trim()) return t('import.url.required');
    return isWebLink(url.trim()) ? undefined : t('import.url.invalid');
  };

  const submit = (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (pending) return;
    const invalid = check();
    if (invalid) {
      setProblem(invalid);
      setOfferText(false);
      setCanRetry(false);
      return;
    }
    // The import would replace what the editor typed, so ask first.
    if (dirty) setConfirming(true);
    else run();
  };

  return (
    <section
      aria-label={t('import.panel.open')}
      className="flex flex-col gap-3"
    >
      {done ? (
        <p
          role="status"
          className="rounded-lg border border-border bg-muted px-3 py-2 text-sm"
        >
          {t('import.panel.done')}
        </p>
      ) : null}
      {!open ? (
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setOpen(true);
              setDone(false);
            }}
          >
            <Sparkles aria-hidden="true" />
            {t('import.panel.open')}
          </Button>
        </div>
      ) : (
        <form
          onSubmit={submit}
          noValidate
          className="flex flex-col gap-4 rounded-xl border border-dashed border-border p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-title">{t('import.panel.open')}</h2>
              <p className="text-sm text-muted-foreground">
                {t('import.panel.hint')}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              <X aria-hidden="true" />
              <span className="sr-only">{t('import.panel.close')}</span>
            </Button>
          </div>
          <ToggleGroup
            type="single"
            aria-label={t('import.mode.label')}
            value={mode}
            onValueChange={(next) => {
              if (next === 'url' || next === 'text') switchMode(next);
            }}
            disabled={pending}
          >
            <ToggleGroupItem value="url">
              <Link aria-hidden="true" />
              {t('import.mode.url')}
            </ToggleGroupItem>
            <ToggleGroupItem value="text">
              <ClipboardPaste aria-hidden="true" />
              {t('import.mode.text')}
            </ToggleGroupItem>
          </ToggleGroup>
          {mode === 'url' ? (
            <FormField
              id="import-url"
              label={t('import.url.label')}
              hint={t('import.url.hint')}
              required
              error={problem}
            >
              {(field) => (
                <Input
                  {...field}
                  type="url"
                  dir="ltr"
                  inputMode="url"
                  autoComplete="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  disabled={pending}
                />
              )}
            </FormField>
          ) : (
            <FormField
              id="import-text"
              label={t('import.text.label')}
              hint={t('import.text.hint')}
              required
              error={problem}
            >
              {(field) => (
                <Textarea
                  {...field}
                  dir="auto"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  disabled={pending}
                  rows={8}
                  className="min-h-40"
                />
              )}
            </FormField>
          )}
          {canRetry || offerText ? (
            <div className="flex flex-wrap gap-2">
              {canRetry ? (
                <Button type="button" variant="secondary" onClick={run}>
                  <RotateCw aria-hidden="true" />
                  {t('import.retry')}
                </Button>
              ) : null}
              {offerText ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => switchMode('text')}
                >
                  <ClipboardPaste aria-hidden="true" />
                  {t('import.url.useText')}
                </Button>
              ) : null}
            </div>
          ) : null}
          {/* Always in the page, so a screen reader reads the text when it appears. */}
          <p role="status" className="min-h-5 text-sm text-muted-foreground">
            {pending ? t('import.pending') : null}
          </p>
          {pending ? <StageChecklist progress={progress} /> : null}
          <SlowNote pending={pending} afterMs={SLOW_AFTER_LONG_MS}>
            {t('pending.slow')}
          </SlowNote>
          <div className="flex justify-end gap-2">
            {pending ? (
              <Button type="button" variant="ghost" onClick={cancel}>
                {t('import.cancel')}
              </Button>
            ) : null}
            <PendingButton
              type="submit"
              pending={pending}
              pendingLabel={t(
                mode === 'url'
                  ? 'import.url.submitting'
                  : 'import.text.submitting',
              )}
            >
              <Sparkles aria-hidden="true" />
              {t(mode === 'url' ? 'import.url.submit' : 'import.text.submit')}
            </PendingButton>
          </div>
        </form>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('import.replace.title')}
        description={t('import.replace.description')}
        confirmLabel={t('import.replace.confirm')}
        cancelLabel={t('import.replace.cancel')}
        onConfirm={run}
      />
    </section>
  );
}

/**
 * Shows what the import is doing: one line for each step the server reports (AD-40).
 * Steps that do not apply ("skipped") are not shown. There is no percentage.
 */
function StageChecklist({ progress }: { progress: Progress }) {
  const { t } = useTranslation();
  const shown = STAGES.filter(
    (name) => progress[name] === 'started' || progress[name] === 'done',
  );
  if (shown.length === 0) return null;
  return (
    <ul aria-label={t('import.stages.label')} className="flex flex-col gap-1">
      {shown.map((name) => {
        const done = progress[name] === 'done';
        return (
          <li
            key={name}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            {done ? (
              <Check aria-hidden="true" className="size-4 text-primary" />
            ) : (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            )}
            <span>{t(`import.stages.${name}`)}</span>
            <span className="sr-only">
              {done ? t('import.stages.done') : t('import.stages.started')}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
