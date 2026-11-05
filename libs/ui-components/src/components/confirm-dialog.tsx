import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { PendingButton, SlowNote } from './pending-button';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The question, naming what it is about (UX: a confirm always names its subject). */
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Runs the action. The dialog stays open until the owner closes it, so a failure can show. */
  onConfirm: () => void;
  /** The action is running: both buttons are disabled and the dialog cannot be dismissed. */
  pending?: boolean;
  /** What the confirm button says while it works ("מוחקים"); defaults to `confirmLabel`. */
  pendingLabel?: string;
  /** Shown under the text when the action takes longer than usual ("זה לוקח יותר זמן"). */
  slowNote?: string;
  /** Styles the confirm button as a destructive action. */
  destructive?: boolean;
  /** Why the action failed. It sits under the text and is announced when it appears. */
  error?: string;
}

/**
 * A "are you sure?" step. Props in, callbacks out: it knows nothing about what it
 * confirms. Unlike the bare `AlertDialogAction` it does not close itself on confirm,
 * so a rejected request can be shown here instead of vanishing.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  pending = false,
  pendingLabel,
  slowNote,
  destructive = false,
  error,
}: ConfirmDialogProps) {
  return (
    <AlertDialog
      open={open}
      // Escape and outside clicks must not close it mid-request.
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {/* Always rendered, so a screen reader announces the text when it appears. */}
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
        {slowNote ? <SlowNote pending={pending}>{slowNote}</SlowNote> : null}
        <AlertDialogFooter>
          <PendingButton
            variant={destructive ? 'destructive' : 'default'}
            pending={pending}
            pendingLabel={pendingLabel ?? confirmLabel}
            onClick={onConfirm}
          >
            {confirmLabel}
          </PendingButton>
          <AlertDialogCancel disabled={pending}>
            {cancelLabel}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
