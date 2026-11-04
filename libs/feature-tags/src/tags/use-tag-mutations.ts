import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  invalidationMap,
  tagsCreateTagMutation,
  tagsDeleteTagMutation,
  tagsUpdateTagMutation,
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

/** Rename and pin share one endpoint: `PATCH /api/tags/{id}`. */
export function useUpdateTag() {
  const refresh = useRefreshAfterWrite();
  return useMutation({ ...tagsUpdateTagMutation(), onSuccess: refresh });
}

export function useDeleteTag() {
  const refresh = useRefreshAfterWrite();
  return useMutation({ ...tagsDeleteTagMutation(), onSuccess: refresh });
}
