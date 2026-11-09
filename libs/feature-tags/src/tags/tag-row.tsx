import { useState } from 'react';
import { Pin, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TagRead } from '@bite-and-board/data-access';
import {
  Button,
  ConfirmDialog,
  Input,
  Toggle,
  toast,
} from '@bite-and-board/ui-components';
import { useErrorMessage } from '../shared/use-error-message';
import { useDeleteTag, useUpdateTag } from './use-tag-mutations';

/**
 * The name field. Saves on Enter or when focus leaves. Escape brings back the old
 * name.
 */
function NameField({ tag }: { tag: TagRead }) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const update = useUpdateTag();
  const [draft, setDraft] = useState(tag.name);
  const [problem, setProblem] = useState<string>();

  const save = () => {
    const name = draft.trim();
    if (name === tag.name) {
      setDraft(tag.name);
      setProblem(undefined);
      return;
    }
    if (!name) {
      setProblem(t('tags.rename.required'));
      return;
    }
    setProblem(undefined);
    update.mutate(
      { path: { tag_id: tag.id }, body: { name } },
      {
        onSuccess: (saved) => setDraft(saved.name),
        onError: (error) => setProblem(errorMessage(error)),
      },
    );
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <Input
        aria-label={t('tags.rename.label', { name: tag.name })}
        aria-invalid={problem ? true : undefined}
        aria-describedby={problem ? `tag-${tag.id}-error` : undefined}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            save();
          } else if (event.key === 'Escape') {
            setDraft(tag.name);
            setProblem(undefined);
          }
        }}
      />
      <p
        id={`tag-${tag.id}-error`}
        role="alert"
        className="text-sm text-destructive"
      >
        {problem}
      </p>
    </div>
  );
}

/**
 * The delete button and its confirmation, which says how many recipes will lose
 * the tag.
 */
function DeleteTag({ tag }: { tag: TagRead }) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const remove = useDeleteTag();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('tags.delete.action', { name: tag.name })}
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden="true" />
      </Button>
      {open ? (
        <ConfirmDialog
          open
          onOpenChange={(next) => {
            if (!next) remove.reset();
            setOpen(next);
          }}
          title={t('tags.delete.title', { name: tag.name })}
          description={t('tags.delete.usage', { count: tag.recipe_count })}
          confirmLabel={t('tags.delete.confirm')}
          cancelLabel={t('tags.cancel')}
          destructive
          pending={remove.isPending}
          pendingLabel={t('tags.delete.pending')}
          slowNote={t('pending.slow')}
          error={remove.isError ? errorMessage(remove.error) : undefined}
          onConfirm={() =>
            remove.mutate(
              { path: { tag_id: tag.id } },
              {
                onSuccess: () => {
                  toast.success(t('tags.delete.done', { name: tag.name }));
                  setOpen(false);
                },
              },
            )
          }
        />
      ) : null}
    </>
  );
}

/** One tag row: rename, pin and delete. */
export function TagRow({ tag }: { tag: TagRead }) {
  const { t } = useTranslation();
  const update = useUpdateTag();
  return (
    <li className="flex items-start gap-2 rounded-xl border bg-card p-3 text-card-foreground">
      {/* The key is the saved name, so new data from the server resets the field. */}
      <NameField key={tag.name} tag={tag} />
      <Toggle
        variant="outline"
        aria-label={t(tag.pinned ? 'tags.pin.unpin' : 'tags.pin.pin', {
          name: tag.name,
        })}
        pressed={tag.pinned}
        onPressedChange={(pinned) =>
          update.mutate(
            { path: { tag_id: tag.id }, body: { pinned } },
            { onError: () => toast.error(t('tags.pin.failed')) },
          )
        }
      >
        <Pin aria-hidden="true" />
      </Toggle>
      <DeleteTag tag={tag} />
    </li>
  );
}
