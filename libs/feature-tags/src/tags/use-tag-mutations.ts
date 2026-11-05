import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  invalidationMap,
  tagsCreateTagMutation,
  tagsDeleteTagMutation,
  tagsListTagsQueryKey,
  tagsUpdateTagMutation,
  type TagRead,
} from '@bite-and-board/data-access';

/** After any tag write the tags, the library list and recipe pages are refreshed (AD-19). */
function useRefreshAfterWrite() {
  const queryClient = useQueryClient();
  return () => invalidationMap.tagWrite(queryClient);
}

export function useCreateTag() {
  const refresh = useRefreshAfterWrite();
  return useMutation({ ...tagsCreateTagMutation(), onSuccess: refresh });
}

/**
 * Rename and pin share one endpoint: `PATCH /api/tags/{id}`.
 *
 * Pinning is the one optimistic write in the app (Story 2.7): it is cheap and easy to
 * undo, so the pin changes at once and goes back if the server refuses. A rename waits
 * for the server. Tag writes run one at a time, so rapid taps reach the server in order.
 */
export function useUpdateTag() {
  const queryClient = useQueryClient();
  const refresh = useRefreshAfterWrite();
  return useMutation({
    ...tagsUpdateTagMutation(),
    scope: { id: 'tags' },
    onMutate: async (variables) => {
      const pinned = variables.body?.pinned;
      if (pinned == null) return { previous: undefined };
      const key = tagsListTagsQueryKey();
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TagRead[]>(key);
      queryClient.setQueryData<TagRead[]>(key, (tags) =>
        tags?.map((tag) =>
          tag.id === variables.path.tag_id ? { ...tag, pinned } : tag,
        ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(tagsListTagsQueryKey(), context.previous);
      }
    },
    // After a refusal too, so the list shows what the server holds.
    onSettled: refresh,
  });
}

export function useDeleteTag() {
  const refresh = useRefreshAfterWrite();
  return useMutation({ ...tagsDeleteTagMutation(), onSuccess: refresh });
}
