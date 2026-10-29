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
  Button,
  FormField,
  Input,
  RequiredNote,
} from '@bite-and-board/ui-components';
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
