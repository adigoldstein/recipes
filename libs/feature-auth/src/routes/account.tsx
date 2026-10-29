import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { z } from 'zod';
import {
  authChangePasswordMutation,
  authSessionQueryKey,
  getErrorCode,
  useBackNavigation,
  useSession,
} from '@bite-and-board/data-access';
import {
  BackLink,
  Button,
  FormField,
  Input,
  RequiredNote,
  toast,
} from '@bite-and-board/ui-components';
import { useErrorMessage } from '../shared/use-error-message';

// Matches the server's policy (FR-13); the server stays the authority.
const MIN_PASSWORD_LENGTH = 8;

// Errors that belong to one field; anything else gets the live line above the button.
const FIELD_ERRORS = new Set([
  'invalid_credentials',
  'password_too_short',
  'password_too_long',
]);

/** One required password input: label, control and error line. */
function PasswordField({
  id,
  label,
  autoComplete,
  error,
  registration,
}: {
  id: string;
  label: string;
  autoComplete: string;
  error?: string;
  registration: UseFormRegisterReturn;
}) {
  return (
    <FormField id={id} label={label} required error={error}>
      {(field) => (
        <Input
          type="password"
          dir="ltr"
          autoComplete={autoComplete}
          {...field}
          {...registration}
        />
      )}
    </FormField>
  );
}

/** Change my own password (FR-27). The server's answer carries a fresh session. */
function ChangePasswordSection() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const change = useMutation(authChangePasswordMutation());

  const schema = z
    .object({
      current: z.string().min(1, t('account.password.currentRequired')),
      next: z
        .string()
        .min(1, t('account.password.newRequired'))
        .min(
          MIN_PASSWORD_LENGTH,
          t('errors.password_too_short', { min: MIN_PASSWORD_LENGTH }),
        ),
      confirm: z.string(),
    })
    .refine((values) => values.next === values.confirm, {
      path: ['confirm'],
      message: t('account.password.mismatch'),
    });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { current: '', next: '', confirm: '' },
  });

  const onSubmit = handleSubmit(({ current, next }) =>
    change.mutate(
      { body: { current_password: current, new_password: next } },
      {
        onSuccess: (response) => {
          // The old cookie no longer matches; the response set the new one, so this
          // device stays signed in (other devices are signed out).
          queryClient.setQueryData(authSessionQueryKey(), response);
          toast.success(t('account.password.done'));
          reset();
        },
        onError: (error) => {
          const code = getErrorCode(error);
          if (code === 'invalid_credentials') {
            setError('current', {
              message: t('account.password.currentWrong'),
            });
          } else if (
            code === 'password_too_short' ||
            code === 'password_too_long'
          ) {
            setError('next', { message: errorMessage(error) });
          }
        },
      },
    ),
  );

  const code = change.isError ? getErrorCode(change.error) : undefined;
  const formLevelError =
    change.isError && !(code && FIELD_ERRORS.has(code))
      ? errorMessage(change.error)
      : null;

  return (
    <section
      aria-labelledby="account-password-title"
      className="flex flex-col gap-4"
    >
      <h2 id="account-password-title" className="text-heading">
        {t('account.password.title')}
      </h2>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <RequiredNote>{t('form.requiredNote')}</RequiredNote>
        <PasswordField
          id="account-current"
          label={t('account.password.current')}
          autoComplete="current-password"
          error={errors.current?.message}
          registration={register('current')}
        />
        <PasswordField
          id="account-new"
          label={t('account.password.new')}
          autoComplete="new-password"
          error={errors.next?.message}
          registration={register('next')}
        />
        <PasswordField
          id="account-confirm"
          label={t('account.password.confirm')}
          autoComplete="new-password"
          error={errors.confirm?.message}
          registration={register('confirm')}
        />
        {/* Always rendered, so a screen reader announces the text when it appears. */}
        <p role="alert" className="text-sm text-destructive">
          {formLevelError}
        </p>
        <Button type="submit" disabled={change.isPending}>
          {change.isPending
            ? t('account.password.submitting')
            : t('account.password.submit')}
        </Button>
      </form>
    </section>
  );
}

/**
 * "החשבון שלי" at `/account` (FR-27). Each part of the account is its own
 * `<section>` in this column, so another one (personal details, Story 7.2) can be
 * added under the password section without reshaping the page.
 */
export function AccountPage() {
  const { t } = useTranslation();
  const { onBack } = useBackNavigation();
  const user = useSession().data?.user;

  return (
    <>
      <title>{t('app.pageTitle', { page: t('account.title') })}</title>
      <div className="mx-auto flex max-w-sm flex-col gap-6 pt-4">
        <BackLink
          label={t('account.back')}
          link={(children) => (
            <Link to="/" onClick={onBack}>
              {children}
            </Link>
          )}
        />
        <div className="flex flex-col gap-1">
          <h1 tabIndex={-1} className="text-title outline-none">
            {t('account.title')}
          </h1>
          {user ? (
            <p className="text-sm text-muted-foreground">
              {user.name} · <bdi dir="ltr">{user.email}</bdi>
            </p>
          ) : null}
        </div>
        <ChangePasswordSection />
      </div>
    </>
  );
}

export { AccountPage as Component };
