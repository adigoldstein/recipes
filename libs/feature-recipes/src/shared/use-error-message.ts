import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { getErrorCode } from '@bite-and-board/data-access';

/** An API error as Hebrew copy (AD-28): `errors.<code>`, or the generic message. */
export function useErrorMessage() {
  const { t, i18n } = useTranslation();
  return (error: unknown) => {
    const code = getErrorCode(error);
    // The code comes from the server, so the key is checked at runtime.
    const key = code ? (`errors.${code}` as ParseKeys) : undefined;
    const message: string =
      key && i18n.exists(key) ? t(key) : t('errors.unknown');
    return message;
  };
}
