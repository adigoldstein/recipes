import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import {
  authLoginMutation,
  authSessionQueryKey,
  useBackNavigation,
  useSession,
} from '@bite-and-board/data-access';
import {
  BackLink,
  PendingButton,
  FormField,
  Input,
  RequiredNote,
} from '@bite-and-board/ui-components';
import { safeNext } from '../shared/safe-next';
import { useErrorMessage } from '../shared/use-error-message';

/**
 * The login page at `/login` (FR-14). A failed login never says which field was
 * wrong.
 */
export function LoginPage() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const session = useSession();
  const { onBack } = useBackNavigation();
  const login = useMutation(authLoginMutation());

  const schema = z.object({
    email: z.string().trim().min(1, t('auth.login.emailRequired')),
    password: z.string().min(1, t('auth.login.passwordRequired')),
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  // If the user is logged in (just now, or from before), go to the page they wanted.
  if (session.data?.user) {
    return <Navigate to={safeNext(params.get('next'))} replace />;
  }

  const onSubmit = handleSubmit((values) =>
    login.mutate(
      { body: values },
      {
        // The login response has the same shape as the session, so put it in the
        // cache. The edit controls then appear without another request.
        onSuccess: (response) =>
          queryClient.setQueryData(authSessionQueryKey(), response),
      },
    ),
  );

  return (
    <>
      <title>{t('app.pageTitle', { page: t('auth.login.title') })}</title>
      <div className="mx-auto flex max-w-sm flex-col pt-4">
        <BackLink
          label={t('auth.login.back')}
          link={(children) => (
            <Link to="/" onClick={onBack}>
              {children}
            </Link>
          )}
        />
        <h1 tabIndex={-1} className="py-6 text-title outline-none">
          {t('auth.login.title')}
        </h1>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <RequiredNote>{t('form.requiredNote')}</RequiredNote>
          <FormField
            id="login-email"
            label={t('auth.login.email')}
            required
            error={errors.email?.message}
          >
            {(field) => (
              <Input
                type="email"
                dir="ltr"
                autoComplete="username"
                {...field}
                {...register('email')}
              />
            )}
          </FormField>
          <FormField
            id="login-password"
            label={t('auth.login.password')}
            required
            error={errors.password?.message}
          >
            {(field) => (
              <Input
                type="password"
                dir="ltr"
                autoComplete="current-password"
                {...field}
                {...register('password')}
              />
            )}
          </FormField>
          {/* Always in the page, so a screen reader reads the text when it appears. */}
          <p role="alert" className="text-sm text-destructive">
            {login.isError ? errorMessage(login.error) : null}
          </p>
          <PendingButton
            type="submit"
            pending={login.isPending}
            pendingLabel={t('auth.login.submitting')}
          >
            {t('auth.login.submit')}
          </PendingButton>
        </form>
      </div>
    </>
  );
}

export { LoginPage as Component };
