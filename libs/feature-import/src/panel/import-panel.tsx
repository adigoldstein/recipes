import { useState } from 'react';
import { ClipboardPaste, Link, Sparkles, X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getErrorCode,
  importsImportTextMutation,
  importsImportUrlMutation,
  type DraftRecipe,
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

/** Fetch failures where pasting the page's text is the way forward (AD-35). */
const FETCH_ERRORS = new Set([
  'fetch_blocked',
  'fetch_challenged',
  'fetch_failed',
  'fetch_too_large',
]);

/** A link the server can try: http or https, nothing else. */
function isWebLink(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/** What the page that hosts the panel gives it. The two libraries never import each other. */
export interface ImportPanelProps {
  /** The form already holds what the editor typed, so an import would replace it. */
  dirty: boolean;
  /** The import produced a draft: the page puts it into its form (AD-22). */
  onDraft: (draft: DraftRecipe) => void;
  /** A request is running or not, so the page can lock its form meanwhile. */
  onBusyChange: (busy: boolean) => void;
}

/**
 * "ייבוא עם בינה מלאכותית" at the top of the new-recipe page (FR-17, FR-18): a button
 * that opens a panel with two ways in, "קישור" (a recipe page's link, Story 5.4) and
 * "הדבקת טקסט". While the import runs the page locks its form; when it ends the form
 * is filled with the draft and nothing is saved until the editor presses "שמירה". A
 * failure leaves the form and the input as they were. When a page cannot be fetched,
 * one click switches to pasting its text.
 */
export function ImportPanel({
  dirty,
  onDraft,
  onBusyChange,
}: ImportPanelProps) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const importText = useMutation(importsImportTextMutation());
  const importUrl = useMutation(importsImportUrlMutation());
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('url');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [problem, setProblem] = useState<string>();
  const [offerText, setOfferText] = useState(false);
  const [done, setDone] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const pending = importText.isPending || importUrl.isPending;

  const callbacks = {
    onSuccess: (draft: DraftRecipe) => {
      onDraft(draft);
      setText('');
      setUrl('');
      setOpen(false);
      setDone(true);
    },
    onError: (error: unknown) => {
      setProblem(errorMessage(error));
      setOfferText(FETCH_ERRORS.has(getErrorCode(error) ?? ''));
    },
    onSettled: () => onBusyChange(false),
  };

  const run = () => {
    setConfirming(false);
    setProblem(undefined);
    setOfferText(false);
    setDone(false);
    onBusyChange(true);
    if (mode === 'url') {
      importUrl.mutate({ body: { url: url.trim() } }, callbacks);
    } else {
      importText.mutate({ body: { text } }, callbacks);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setProblem(undefined);
    setOfferText(false);
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
          {offerText ? (
            <div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => switchMode('text')}
              >
                <ClipboardPaste aria-hidden="true" />
                {t('import.url.useText')}
              </Button>
            </div>
          ) : null}
          {/* Always rendered, so a screen reader announces the text when it appears. */}
          <p role="status" className="min-h-5 text-sm text-muted-foreground">
            {pending ? t('import.pending') : null}
          </p>
          <SlowNote pending={pending} afterMs={SLOW_AFTER_LONG_MS}>
            {t('pending.slow')}
          </SlowNote>
          <div className="flex justify-end">
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
