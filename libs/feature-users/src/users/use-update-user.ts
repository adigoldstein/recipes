import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import {
  authSessionQueryKey,
  useSession,
  usersListUsersQueryKey,
  usersUpdateUserMutation,
} from '@bite-and-board/data-access';

/**
 * `PATCH /api/users/{id}` for the Users screen. On success the list is refreshed.
 *
 * If the admin changed their own account (stepped down, or blocked themselves),
 * they just lost this screen: the session is re-read and they are sent home
 * instead of watching the list fail with a 403 or 401.
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const selfId = useSession().data?.user?.id;

  return useMutation({
    ...usersUpdateUserMutation(),
    onSuccess: async (updated) => {
      if (updated.id === selfId) {
        queryClient.removeQueries({ queryKey: usersListUsersQueryKey() });
        await queryClient.invalidateQueries({
          queryKey: authSessionQueryKey(),
        });
        await navigate('/', { replace: true });
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: usersListUsersQueryKey(),
      });
    },
  });
}
