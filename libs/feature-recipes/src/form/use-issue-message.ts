import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { FieldIssue } from '@bite-and-board/data-access';

// Server types that read the same to a person as one of ours.
const SAME_MESSAGE: Record<string, string> = {
  missing: 'required',
  int_parsing: 'integer',
  int_from_float: 'integer',
  int_type: 'integer',
  decimal_parsing: 'number',
  decimal_type: 'number',
  finite_number: 'number',
};

/**
 * A field problem as Hebrew copy (AD-9, AD-28), whether it came from the server's 422
 * or from the client check. It looks for `validation.fields.<path>.<type>` (with the
 * row numbers dropped) and then `validation.<type>`, and falls back to
 * `validation.invalid`.
 */
export function useIssueMessage() {
  const { t, i18n } = useTranslation();
  return (issue: FieldIssue) => {
    const type =
      issue.type === 'string_too_short' && issue.params['min_length'] === 1
        ? 'required'
        : (SAME_MESSAGE[issue.type] ?? issue.type);
    const field = issue.path.replace(/\.\d+(?=\.|$)/g, '');
    const candidates = [
      `validation.fields.${field}.${type}`,
      `validation.${type}`,
    ];
    // The type comes from the server, so the key is checked at runtime.
    const key = candidates.find((candidate) => i18n.exists(candidate));
    const message: string = t(
      (key ?? 'validation.invalid') as ParseKeys,
      issue.params,
    );
    return message;
  };
}
