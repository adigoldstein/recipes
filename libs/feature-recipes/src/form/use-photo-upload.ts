import { useEffect, useRef, useState } from 'react';
import type { UseFormGetValues, UseFormSetValue } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  getErrorCode,
  uploadPhoto,
  type PhotoLimits,
} from '@bite-and-board/data-access';
import { useErrorMessage } from '../shared/use-error-message';
import type { RecipeFormValues } from './recipe-form-values';

interface Options {
  getValues: UseFormGetValues<RecipeFormValues>;
  setValue: UseFormSetValue<RecipeFormValues>;
  /** The server's limits, when they have loaded; used to refuse a file at once. */
  limits: PhotoLimits | undefined;
  /** The recipe's saved photo thumbnail, if any (so removing it must be sent, and can be undone). */
  savedPreview: string | null;
}

const isAbort = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError';

/**
 * The form's photo: picking a file uploads it at once and keeps its key in the form
 * (AD-27); the recipe save then attaches it. `photoKey` is only set when the photo
 * changed, so a form that never touched it leaves the saved photo alone.
 */
export function usePhotoUpload({
  getValues,
  setValue,
  limits,
  savedPreview,
}: Options) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const [progress, setProgress] = useState<number | undefined>();
  const [error, setError] = useState<string | undefined>();
  const controller = useRef<AbortController | null>(null);
  const blobUrl = useRef<string | null>(null);

  const forgetBlob = () => {
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    blobUrl.current = null;
  };

  // Leaving the form ends an upload in flight and frees the preview.
  useEffect(
    () => () => {
      controller.current?.abort();
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    },
    [],
  );

  const select = async (file: File) => {
    setError(undefined);
    // The same limits the server enforces, so a wrong file is refused without a trip.
    if (limits && !limits.content_types.includes(file.type)) {
      setError(t('errors.photo_unsupported_type'));
      return;
    }
    if (limits && file.size > limits.max_bytes) {
      setError(t('errors.photo_too_large'));
      return;
    }

    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const before = {
      key: getValues('photoKey'),
      preview: getValues('photoPreview'),
    };
    const preview = URL.createObjectURL(file);
    setValue('photoPreview', preview);
    setProgress(0);
    try {
      const { photo_key } = await uploadPhoto(file, {
        onProgress: setProgress,
        signal: current.signal,
      });
      forgetBlob();
      blobUrl.current = preview;
      setValue('photoKey', photo_key, { shouldDirty: true });
    } catch (caught) {
      URL.revokeObjectURL(preview);
      if (isAbort(caught)) return;
      // The picture that was there before stays.
      setValue('photoPreview', before.preview);
      setValue('photoKey', before.key);
      setError(
        getErrorCode(caught)
          ? errorMessage(caught)
          : t('recipeForm.photo.failed'),
      );
    } finally {
      if (controller.current === current) {
        controller.current = null;
        setProgress(undefined);
      }
    }
  };

  const remove = () => {
    setError(undefined);
    forgetBlob();
    // A photo that was never saved just goes; a saved one is removed on save.
    setValue('photoKey', savedPreview ? null : undefined, {
      shouldDirty: true,
    });
    setValue('photoPreview', null, { shouldDirty: true });
  };

  // Back to the saved photo, as if it had never been touched (until the save).
  const restore = () => {
    setError(undefined);
    forgetBlob();
    setValue('photoKey', undefined, { shouldDirty: true });
    setValue('photoPreview', savedPreview, { shouldDirty: true });
  };

  return {
    progress,
    error,
    uploading: progress !== undefined,
    canRestore: savedPreview !== null,
    select,
    remove,
    restore,
  };
}
