import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Button } from './ui/button';

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
        <AlertDialogFooter>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={pending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
          <AlertDialogCancel disabled={pending}>
            {cancelLabel}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
