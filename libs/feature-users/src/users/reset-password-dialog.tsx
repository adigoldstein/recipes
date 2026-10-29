import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { getErrorCode, type UserRead } from '@bite-and-board/data-access';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  RequiredNote,
  toast,
} from '@bite-and-board/ui-components';
import { useErrorMessage } from '../shared/use-error-message';
import { useUpdateUser } from './use-update-user';

// Matches the server's policy (FR-13); the server stays the authority.
const MIN_PASSWORD_LENGTH = 8;

export interface ResetPasswordDialogProps {
  user: UserRead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ResetPasswordForm({
  user,
  onDone,
}: {
  user: UserRead;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const update = useUpdateUser();

  const schema = z
    .object({
      password: z
        .string()
        .min(1, t('users.reset.passwordRequired'))
        .min(
          MIN_PASSWORD_LENGTH,
          t('errors.password_too_short', { min: MIN_PASSWORD_LENGTH }),
        ),
      confirm: z.string(),
    })
    .refine((values) => values.password === values.confirm, {
      path: ['confirm'],
      message: t('users.reset.passwordMismatch'),
    });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  });

  const onSubmit = handleSubmit(({ password }) =>
    update.mutate(
      { path: { user_id: user.id }, body: { password } },
      {
        onSuccess: () => {
          toast.success(t('users.reset.done', { name: user.name }));
          onDone();
        },
        // A password the server rejects belongs to the password field.
        onError: (error) => {
          const code = getErrorCode(error);
          if (code === 'password_too_short' || code === 'password_too_long') {
            setError('password', { message: errorMessage(error) });
          }
        },
      },
    ),
  );

  const code = update.isError ? getErrorCode(update.error) : undefined;
  const formError =
    update.isError &&
    code !== 'password_too_short' &&
    code !== 'password_too_long';

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <RequiredNote>{t('form.requiredNote')}</RequiredNote>
      <FormField
        id="reset-password"
        label={t('users.reset.password')}
        required
        error={errors.password?.message}
      >
        {(field) => (
          <Input
            type="password"
            dir="ltr"
            autoComplete="new-password"
            {...field}
            {...register('password')}
          />
        )}
      </FormField>
      <FormField
        id="reset-confirm"
        label={t('users.reset.confirm')}
        required
        error={errors.confirm?.message}
      >
        {(field) => (
          <Input
            type="password"
            dir="ltr"
            autoComplete="new-password"
            {...field}
            {...register('confirm')}
          />
        )}
      </FormField>
      {/* Always rendered, so a screen reader announces the text when it appears. */}
      <p role="alert" className="text-sm text-destructive">
        {formError ? errorMessage(update.error) : null}
      </p>
      <DialogFooter>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending
            ? t('users.reset.submitting')
            : t('users.reset.submit')}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          {t('users.cancel')}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** "איפוס סיסמה": the admin sets a new password for someone, who is signed out everywhere. */
export function ResetPasswordDialog({
  user,
  open,
  onOpenChange,
}: ResetPasswordDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('users.close')}>
        <DialogHeader>
          <DialogTitle>
            {t('users.reset.title', { name: user.name })}
          </DialogTitle>
          <DialogDescription>
            {t('users.reset.description', { name: user.name })}
          </DialogDescription>
        </DialogHeader>
        <ResetPasswordForm user={user} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
