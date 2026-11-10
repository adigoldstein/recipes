import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { getErrorCode, getErrorParams } from '@bite-and-board/data-access';

/**
 * Turns an API error into a Hebrew message (AD-28): `errors.<code>` with the error's
 * `params` filled in, or a general message.
 */
export function useErrorMessage() {
  const { t, i18n } = useTranslation();
  return (error: unknown) => {
    const code = getErrorCode(error);
    // The code comes from the server, so we check that the key exists at runtime.
    const key = code ? (`errors.${code}` as ParseKeys) : undefined;
    const message: string =
      key && i18n.exists(key)
        ? t(key, getErrorParams(error))
        : t('errors.unknown');
    return message;
  };
}
