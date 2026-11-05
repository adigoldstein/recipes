import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  importsImportTextMutation,
  type DraftRecipe,
} from '@bite-and-board/data-access';
import {
  Button,
  ConfirmDialog,
  FormField,
  PendingButton,
  SLOW_AFTER_LONG_MS,
  SlowNote,
  Textarea,
} from '@bite-and-board/ui-components';
import { useErrorMessage } from '../shared/use-error-message';

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
 * that opens a panel where recipe text is pasted. While the import runs the page locks
 * its form; when it ends the form is filled with the draft and nothing is saved until
 * the editor presses "שמירה". A failure leaves the form and the pasted text as they were.
 * This story has the pasted-text input; the link input comes with Story 5.4.
 */
export function ImportPanel({
  dirty,
  onDraft,
  onBusyChange,
}: ImportPanelProps) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const importText = useMutation(importsImportTextMutation());
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string>();
  const [done, setDone] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const run = () => {
    setConfirming(false);
    setProblem(undefined);
    setDone(false);
    onBusyChange(true);
    importText.mutate(
      { body: { text } },
      {
        onSuccess: (draft) => {
          onDraft(draft);
          setText('');
          setOpen(false);
          setDone(true);
        },
        onError: (error) => setProblem(errorMessage(error)),
        onSettled: () => onBusyChange(false),
      },
    );
  };

  const submit = (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (importText.isPending) return;
    if (!text.trim()) {
      setProblem(t('import.text.required'));
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
              disabled={importText.isPending}
              onClick={() => setOpen(false)}
            >
              <X aria-hidden="true" />
              <span className="sr-only">{t('import.panel.close')}</span>
            </Button>
          </div>
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
                disabled={importText.isPending}
                rows={8}
                className="min-h-40"
              />
            )}
          </FormField>
          {/* Always rendered, so a screen reader announces the text when it appears. */}
          <p role="status" className="min-h-5 text-sm text-muted-foreground">
            {importText.isPending ? t('import.pending') : null}
          </p>
          <SlowNote pending={importText.isPending} afterMs={SLOW_AFTER_LONG_MS}>
            {t('pending.slow')}
          </SlowNote>
          <div className="flex justify-end">
            <PendingButton
              type="submit"
              pending={importText.isPending}
              pendingLabel={t('import.text.submitting')}
            >
              <Sparkles aria-hidden="true" />
              {t('import.text.submit')}
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
