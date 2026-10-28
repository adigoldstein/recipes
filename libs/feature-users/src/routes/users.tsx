import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  usersListUsersOptions,
  type UserRead,
} from '@bite-and-board/data-access';
import { Button, EmptyState, Skeleton } from '@bite-and-board/ui-components';
import { AddUserDialog } from '../users/add-user-dialog';
import { useErrorMessage } from '../shared/use-error-message';

const SKELETON_COUNT = 3;

/** One account: name and role, the email below it, and a label when blocked. */
function UserRow({ user }: { user: UserRead }) {
  const { t } = useTranslation();
  return (
    <li className="flex flex-col gap-1 rounded-xl border bg-card p-4 text-card-foreground">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-heading">{user.name}</span>
        <span className="text-sm text-muted-foreground">
          {t(`users.role.${user.role}`)}
        </span>
        {user.is_blocked ? (
          <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-sm text-destructive">
            {t('users.blocked')}
          </span>
        ) : null}
      </div>
      <span className="text-sm break-all text-muted-foreground">
        <bdi dir="ltr">{user.email}</bdi>
      </span>
    </li>
  );
}

/** The admin's Users screen at `/users` (FR-25): everyone, and a way to add someone. */
export function UsersPage() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const users = useQuery(usersListUsersOptions());
  const [adding, setAdding] = useState(false);

  const renderBody = () => {
    if (users.isPending) {
      return (
        <div
          role="status"
          aria-label={t('users.loading')}
          className="grid gap-3"
        >
          {Array.from({ length: SKELETON_COUNT }, (_, n) => (
            <Skeleton key={n} className="h-20 rounded-xl" />
          ))}
        </div>
      );
    }
    if (users.isError) {
      return (
        <EmptyState
          title={errorMessage(users.error)}
          actions={
            <Button variant="secondary" onClick={() => void users.refetch()}>
              {t('users.retry')}
            </Button>
          }
        />
      );
    }
    return (
      <ul aria-label={t('users.list')} className="grid gap-3">
        {users.data.map((user) => (
          <UserRow key={user.id} user={user} />
        ))}
      </ul>
    );
  };

  return (
    <>
      <title>{t('app.pageTitle', { page: t('users.title') })}</title>
      <div className="mx-auto flex max-w-detail flex-col gap-6 pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 tabIndex={-1} className="text-title outline-none">
            {t('users.title')}
          </h1>
          <Button onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" />
            {t('users.add.open')}
          </Button>
        </div>
        {renderBody()}
      </div>
      <AddUserDialog open={adding} onOpenChange={setAdding} />
    </>
  );
}

export { UsersPage as Component };
