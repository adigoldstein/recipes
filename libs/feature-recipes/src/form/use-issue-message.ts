import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { FieldIssue } from '@bite-and-board/data-access';

// Server error types that mean the same as one of ours, so they get the same message.
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
 * Turns a field problem into a Hebrew message (AD-9, AD-28), whether it came from the
 * server's 422 or from the client check. It looks for
 * `validation.fields.<path>.<type>` (without row numbers), then `validation.<type>`,
 * and otherwise uses `validation.invalid`.
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
    // The type comes from the server, so we check that the key exists at runtime.
    const key = candidates.find((candidate) => i18n.exists(candidate));
    const message: string = t(
      (key ?? 'validation.invalid') as ParseKeys,
      issue.params,
    );
    return message;
  };
}
