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
  /** The question. It always names what it is about (a UX rule). */
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  /**
   * Runs the action. The dialog stays open until the parent closes it, so an error
   * can be shown.
   */
  onConfirm: () => void;
  /**
   * True while the action runs. Both buttons are disabled, and the dialog cannot be
   * closed.
   */
  pending?: boolean;
  /** The confirm button's text while it works ("מוחקים"). Defaults to `confirmLabel`. */
  pendingLabel?: string;
  /** Shown under the text if the action takes longer than usual ("זה לוקח יותר זמן"). */
  slowNote?: string;
  /** Shows the confirm button as a dangerous action (for example, delete). */
  destructive?: boolean;
  /** Why the action failed. Shown under the text, and read aloud when it appears. */
  error?: string;
}

/**
 * An "are you sure?" dialog. It gets props and calls callbacks, and knows nothing
 * about what it confirms. Unlike the plain `AlertDialogAction`, it does not close by
 * itself on confirm, so a failed request can be shown here instead of disappearing.
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
      // Escape and clicks outside must not close it while the request runs.
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {/* Always in the page, so a screen reader reads the text when it appears. */}
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
