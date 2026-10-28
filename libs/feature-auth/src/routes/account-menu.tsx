import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import {
  authLogoutMutation,
  authSessionQueryKey,
  useCan,
  useSession,
} from '@bite-and-board/data-access';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
} from '@bite-and-board/ui-components';

/**
 * The top bar's account slot (UX-DR4): "כניסה" for a visitor, the user's name with
 * an account menu once signed in. It is its own chunk, so the app shell does not
 * pull the API client into the first load.
 */
export function AccountMenu() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const location = useLocation();
  const session = useSession();
  const isAdmin = useCan('admin');
  const logout = useMutation({
    ...authLogoutMutation(),
    onSuccess: async () => {
      // Visitor right away, then confirm with the server.
      queryClient.setQueryData(authSessionQueryKey(), { user: null });
      await queryClient.invalidateQueries({ queryKey: authSessionQueryKey() });
      // Only this menu logs out on purpose; an expired session and a self-block
      // have their own messages. A failed logout shows nothing, as before.
      toast.success(t('auth.logoutDone'));
    },
  });

  const user = session.data?.user;
  if (user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost">
            {user.name}
            <ChevronDown aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to="/account">{t('auth.menu.account')}</Link>
          </DropdownMenuItem>
          {isAdmin ? (
            <DropdownMenuItem asChild>
              <Link to="/users">{t('auth.menu.users')}</Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => logout.mutate({})}>
            {t('auth.menu.logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Nothing while the first answer is loading, and none on the login page itself.
  if (!session.data || location.pathname === '/login') return null;
  const next = `${location.pathname}${location.search}`;
  return (
    <Button asChild variant="ghost">
      <Link
        to={next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`}
      >
        {t('auth.menu.login')}
      </Link>
    </Button>
  );
}
