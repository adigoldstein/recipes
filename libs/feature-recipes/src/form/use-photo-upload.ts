import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { UseFormGetValues, UseFormSetValue } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  getErrorCode,
  photosUploadPhotoFromUrlMutation,
  uploadPhoto,
  type PhotoLimits,
} from '@bite-and-board/data-access';
import { useErrorMessage } from '../shared/use-error-message';
import type { RecipeFormValues } from './recipe-form-values';

interface Options {
  getValues: UseFormGetValues<RecipeFormValues>;
  setValue: UseFormSetValue<RecipeFormValues>;
  /** The server's limits, once loaded. Used to reject a wrong file right away. */
  limits: PhotoLimits | undefined;
  /**
   * The recipe's saved photo thumbnail, if any. If there is one, removing it must
   * be sent on save, and can be undone.
   */
  savedPreview: string | null;
}

const isAbort = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError';

/**
 * Handles the form's photo. Choosing a file uploads it right away and keeps its key
 * in the form (AD-27). Saving the recipe then attaches it. `photoKey` is set only
 * when the photo changed, so if the user did not touch it, the saved photo stays.
 *
 * An imported recipe can have a photo from its page (`photoSourceUrl`). `download`
 * asks the server to download it when saving (AD-23). Choosing or removing a photo
 * removes it.
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
  const fromUrl = useMutation(photosUploadPhotoFromUrlMutation());
  const controller = useRef<AbortController | null>(null);
  const blobUrl = useRef<string | null>(null);

  const forgetBlob = () => {
    if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    blobUrl.current = null;
  };

  // When leaving the form, cancel an upload in progress and free the preview.
  useEffect(
    () => () => {
      controller.current?.abort();
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    },
    [],
  );

  const select = async (file: File) => {
    setError(undefined);
    // Check the same limits as the server, so a wrong file is rejected without
    // sending it.
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
      setValue('photoSourceUrl', null);
    } catch (caught) {
      URL.revokeObjectURL(preview);
      if (isAbort(caught)) return;
      // Put back the picture that was there before.
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
    // A photo that was never saved is just removed. A saved photo is removed when
    // the recipe is saved.
    setValue('photoKey', savedPreview ? null : undefined, {
      shouldDirty: true,
    });
    setValue('photoPreview', null, { shouldDirty: true });
    setValue('photoSourceUrl', null);
  };

  /**
   * Asks the server to download the imported photo and returns its key. Returns
   * `undefined` if it failed. Then a message is shown under the photo, and "הסרה"
   * lets the editor save without it.
   */
  const download = async (sourceUrl: string): Promise<string | undefined> => {
    setError(undefined);
    setProgress(0);
    try {
      const { photo_key } = await fromUrl.mutateAsync({
        body: { source_url: sourceUrl },
      });
      setValue('photoKey', photo_key, { shouldDirty: true });
      setValue('photoSourceUrl', null);
      return photo_key;
    } catch {
      // Use our own message: the download error messages talk about pasting text,
      // which does not fit a photo.
      setError(t('recipeForm.photo.downloadFailed'));
      return undefined;
    } finally {
      setProgress(undefined);
    }
  };

  // Go back to the saved photo, as if it was never changed.
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
    download,
  };
}
