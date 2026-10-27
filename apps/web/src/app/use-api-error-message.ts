import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { getErrorCode } from '@bite-and-board/data-access';

/**
 * Turns an API error into Hebrew copy (AD-28): `errors.<code>` from he.json,
 * and the generic message for a missing or unknown code.
 */
export function useApiErrorMessage() {
  const { t, i18n } = useTranslation();
  return (error: unknown) => {
    const code = getErrorCode(error);
    // The code comes from the server, so the key is checked at runtime, not by the typed keys.
    const key = code ? (`errors.${code}` as ParseKeys) : undefined;
    return key && i18n.exists(key) ? t(key) : t('errors.unknown');
  };
}
