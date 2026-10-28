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
import { BackLink, Button, Input, Label } from '@bite-and-board/ui-components';
import { safeNext } from '../shared/safe-next';
import { useErrorMessage } from '../shared/use-error-message';

/** The login page at `/login` (FR-14). Wrong credentials never say which field. */
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

  // Signed in, whether just now or already before: go where the visitor was headed.
  if (session.data?.user) {
    return <Navigate to={safeNext(params.get('next'))} replace />;
  }

  const onSubmit = handleSubmit((values) =>
    login.mutate(
      { body: values },
      {
        // The login answer has the session's shape, so it fills the cache directly
        // and the editing controls appear without another request.
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="login-email">{t('auth.login.email')}</Label>
            <Input
              id="login-email"
              type="email"
              dir="ltr"
              autoComplete="username"
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? 'login-email-error' : undefined}
              {...register('email')}
            />
            {errors.email ? (
              <p id="login-email-error" className="text-sm text-destructive">
                {errors.email.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="login-password">{t('auth.login.password')}</Label>
            <Input
              id="login-password"
              type="password"
              dir="ltr"
              autoComplete="current-password"
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={
                errors.password ? 'login-password-error' : undefined
              }
              {...register('password')}
            />
            {errors.password ? (
              <p id="login-password-error" className="text-sm text-destructive">
                {errors.password.message}
              </p>
            ) : null}
          </div>
          {/* Always rendered, so a screen reader announces the text when it appears. */}
          <p role="alert" className="text-sm text-destructive">
            {login.isError ? errorMessage(login.error) : null}
          </p>
          <Button type="submit" disabled={login.isPending}>
            {login.isPending
              ? t('auth.login.submitting')
              : t('auth.login.submit')}
          </Button>
        </form>
      </div>
    </>
  );
}

export { LoginPage as Component };
