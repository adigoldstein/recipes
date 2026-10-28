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

/** The one-step changes; each has its own words under `users.change.<name>`. */
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
  /** This row is the signed-in admin: they use "החשבון שלי" for their own password. */
  isSelf: boolean;
  /** Nobody else is an active admin, so this user can be neither demoted nor blocked. */
  isLastAdmin: boolean;
}

/** Mounted only while open, so each opening starts without an old error. */
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

/** The "⋮" menu on a user's row: change role, block or unblock, reset password. */
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
