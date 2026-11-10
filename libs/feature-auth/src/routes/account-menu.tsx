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
 * The account area in the top bar (UX-DR4): "כניסה" for a visitor, and the user's
 * name with an account menu after login. It is a separate chunk, so the app layout
 * does not add the API client to the first load.
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
      // Show the user as a visitor right away, then check with the server.
      queryClient.setQueryData(authSessionQueryKey(), { user: null });
      await queryClient.invalidateQueries({ queryKey: authSessionQueryKey() });
      // Show "logged out" only here, where the user chose to log out. An expired
      // session and a blocked account have their own messages. A failed logout
      // shows nothing.
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
          <DropdownMenuItem asChild>
            <Link to="/tags">{t('auth.menu.tags')}</Link>
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

  // Show nothing while the session loads, and nothing on the login page itself.
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
