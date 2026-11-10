import { useState } from 'react';
import { EllipsisVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { UserRead, UserUpdate } from '@bite-and-board/data-access';
import {
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  toast,
} from '@bite-and-board/ui-components';
import { useErrorMessage } from '../shared/use-error-message';
import { ResetPasswordDialog } from './reset-password-dialog';
import { useUpdateUser } from './use-update-user';

/** The simple changes. Each has its own texts under `users.change.<name>`. */
type Change = 'makeAdmin' | 'makeEditor' | 'block' | 'unblock';

const CHANGES: Record<Change, UserUpdate> = {
  makeAdmin: { role: 'admin' },
  makeEditor: { role: 'editor' },
  block: { is_blocked: true },
  unblock: { is_blocked: false },
};

type Dialog = Change | 'reset' | null;

export interface UserActionsProps {
  user: UserRead;
  /**
   * True if this row is the logged-in admin. They change their own password in
   * "החשבון שלי".
   */
  isSelf: boolean;
  /**
   * True if no one else is an active admin, so this user cannot be demoted or
   * blocked.
   */
  isLastAdmin: boolean;
}

/**
 * The confirmation dialog of a change. It exists only while open, so it never shows
 * an old error.
 */
function ConfirmChange({
  user,
  change,
  onClose,
}: {
  user: UserRead;
  change: Change;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const update = useUpdateUser();
  const name = user.name;

  return (
    <ConfirmDialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t(`users.change.${change}.title`, { name })}
      description={t(`users.change.${change}.description`, { name })}
      confirmLabel={t(`users.change.${change}.action`)}
      cancelLabel={t('users.cancel')}
      destructive={change === 'block'}
      pending={update.isPending}
      pendingLabel={t('users.change.pending')}
      error={update.isError ? errorMessage(update.error) : undefined}
      onConfirm={() =>
        update.mutate(
          { path: { user_id: user.id }, body: CHANGES[change] },
          {
            onSuccess: () => {
              toast.success(t(`users.change.${change}.done`, { name }));
              onClose();
            },
          },
        )
      }
    />
  );
}

/** The "⋮" menu of a user row: change role, block or unblock, and reset password. */
export function UserActions({ user, isSelf, isLastAdmin }: UserActionsProps) {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState<Dialog>(null);

  const roleChange: Change = user.role === 'admin' ? 'makeEditor' : 'makeAdmin';
  const blockChange: Change = user.is_blocked ? 'unblock' : 'block';
  const close = () => setDialog(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('users.actions.open', { name: user.name })}
          >
            <EllipsisVertical aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isLastAdmin ? (
            <>
              <DropdownMenuLabel>{t('users.lastAdmin')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem
            disabled={isLastAdmin}
            onSelect={() => setDialog(roleChange)}
          >
            {t(`users.change.${roleChange}.action`)}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={isLastAdmin}
            variant={blockChange === 'block' ? 'destructive' : 'default'}
            onSelect={() => setDialog(blockChange)}
          >
            {t(`users.change.${blockChange}.action`)}
          </DropdownMenuItem>
          {isSelf ? null : (
            <DropdownMenuItem onSelect={() => setDialog('reset')}>
              {t('users.reset.action')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {dialog && dialog !== 'reset' ? (
        <ConfirmChange user={user} change={dialog} onClose={close} />
      ) : null}
      {isSelf ? null : (
        <ResetPasswordDialog
          user={user}
          open={dialog === 'reset'}
          onOpenChange={(open) => setDialog(open ? 'reset' : null)}
        />
      )}
    </>
  );
}
