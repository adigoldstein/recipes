import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  invalidationMap,
  tagsCreateTagMutation,
  tagsDeleteTagMutation,
  tagsListTagsQueryKey,
  tagsUpdateTagMutation,
  type TagRead,
} from '@bite-and-board/data-access';

/** After any tag change, reload the tags, the library and the recipe pages (AD-19). */
function useRefreshAfterWrite() {
  const queryClient = useQueryClient();
  return () => invalidationMap.tagWrite(queryClient);
}

export function useCreateTag() {
  const refresh = useRefreshAfterWrite();
  return useMutation({ ...tagsCreateTagMutation(), onSuccess: refresh });
}

/**
 * Renames or pins a tag. Both use the same endpoint: `PATCH /api/tags/{id}`.
 *
 * A rename waits for the server. Pinning is the only "optimistic" change in the app
 * (Story 2.7): it is cheap and easy to undo, so the screen changes right away, and
 * goes back if the server refuses.
 */
export function useUpdateTag() {
  const queryClient = useQueryClient();
  const refresh = useRefreshAfterWrite();
  return useMutation({
    ...tagsUpdateTagMutation(),
    // Tag changes run one at a time, so fast clicks reach the server in order.
    scope: { id: 'tags' },
    // For a pin: update the list right away, and remember the old list.
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
    // If the server refused, put the old list back.
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(tagsListTagsQueryKey(), context.previous);
      }
    },
    // Reload also after an error, so the list shows what the server really has.
    onSettled: refresh,
  });
}

export function useDeleteTag() {
  const refresh = useRefreshAfterWrite();
  return useMutation({ ...tagsDeleteTagMutation(), onSuccess: refresh });
}
