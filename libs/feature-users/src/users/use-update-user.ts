import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import {
  authSessionQueryKey,
  useSession,
  usersListUsersQueryKey,
  usersUpdateUserMutation,
} from '@bite-and-board/data-access';

/** Updates a user (`PATCH /api/users/{id}`) from the users page. */
export function useUpdateUser() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const selfId = useSession().data?.user?.id;

  return useMutation({
    ...usersUpdateUserMutation(),
    onSuccess: async (updated) => {
      // If the admin changed their own account (became an editor, or blocked
      // themselves), they can no longer see this page. Reload the session and go to
      // the home page, instead of showing the list fail with a 403 or 401.
      if (updated.id === selfId) {
        queryClient.removeQueries({ queryKey: usersListUsersQueryKey() });
        await queryClient.invalidateQueries({
          queryKey: authSessionQueryKey(),
        });
        await navigate('/', { replace: true });
        return;
      }
      // Otherwise, reload the user list.
      await queryClient.invalidateQueries({
        queryKey: usersListUsersQueryKey(),
      });
    },
  });
}
