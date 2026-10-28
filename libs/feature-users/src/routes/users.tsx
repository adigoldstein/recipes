import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  useBackNavigation,
  useSession,
  usersListUsersOptions,
  type UserRead,
} from '@bite-and-board/data-access';
import {
  BackLink,
  Button,
  EmptyState,
  Skeleton,
} from '@bite-and-board/ui-components';
import { AddUserDialog } from '../users/add-user-dialog';
import { UserActions } from '../users/user-actions';
import { useErrorMessage } from '../shared/use-error-message';

const SKELETON_COUNT = 3;

/** One account: name and role, the email below it, a label when blocked, and its actions. */
function UserRow({
  user,
  isSelf,
  isLastAdmin,
}: {
  user: UserRead;
  isSelf: boolean;
  isLastAdmin: boolean;
}) {
  const { t } = useTranslation();
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 text-card-foreground">
      <div className="flex min-w-0 flex-col gap-1">
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
      </div>
      <UserActions user={user} isSelf={isSelf} isLastAdmin={isLastAdmin} />
    </li>
  );
}

/** The admin's Users screen at `/users` (FR-25): everyone, and a way to add someone. */
export function UsersPage() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const users = useQuery(usersListUsersOptions());
  const selfId = useSession().data?.user?.id;
  const { onBack } = useBackNavigation();
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
    // The last active admin must stay (AD-30); the server enforces it, and the
    // controls say so up front.
    const activeAdmins = users.data.filter(
      (user) => user.role === 'admin' && !user.is_blocked,
    );
    const lastAdminId =
      activeAdmins.length === 1 ? activeAdmins[0].id : undefined;
    return (
      <ul aria-label={t('users.list')} className="grid gap-3">
        {users.data.map((user) => (
          <UserRow
            key={user.id}
            user={user}
            isSelf={user.id === selfId}
            isLastAdmin={user.id === lastAdminId}
          />
        ))}
      </ul>
    );
  };

  return (
    <>
      <title>{t('app.pageTitle', { page: t('users.title') })}</title>
      <div className="mx-auto flex max-w-detail flex-col gap-6 pt-4">
        <BackLink
          label={t('users.back')}
          link={(children) => (
            <Link to="/" onClick={onBack}>
              {children}
            </Link>
          )}
        />
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
