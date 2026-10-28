import type { ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  getErrorCode,
  usersCreateUserMutation,
  usersListUsersQueryKey,
  type Role,
} from '@bite-and-board/data-access';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@bite-and-board/ui-components';
import { useErrorMessage } from '../shared/use-error-message';

// Matches the server's policy (FR-13); the server stays the authority.
const MIN_PASSWORD_LENGTH = 8;
const ROLES: Role[] = ['editor', 'admin'];
// Errors the form shows on a field; any other error shows under the form.
const FIELD_ERRORS = ['email_taken', 'password_too_short', 'password_too_long'];

export interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** A field's label, control and error line. The control points at `${id}-error`. */
function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function AddUserForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const create = useMutation(usersCreateUserMutation());

  const schema = z
    .object({
      email: z
        .string()
        .trim()
        .min(1, t('users.add.emailRequired'))
        .pipe(z.email(t('users.add.emailInvalid'))),
      name: z.string().trim().min(1, t('users.add.nameRequired')),
      role: z.enum(['editor', 'admin']),
      password: z
        .string()
        .min(1, t('users.add.passwordRequired'))
        .min(
          MIN_PASSWORD_LENGTH,
          t('errors.password_too_short', { min: MIN_PASSWORD_LENGTH }),
        ),
      confirm: z.string(),
    })
    .refine((values) => values.password === values.confirm, {
      path: ['confirm'],
      message: t('users.add.passwordMismatch'),
    });
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      name: '',
      role: 'editor' as Role,
      password: '',
      confirm: '',
    },
  });

  const onSubmit = handleSubmit(({ email, name, role, password }) =>
    create.mutate(
      { body: { email, name, role, password } },
      {
        onSuccess: async (user) => {
          await queryClient.invalidateQueries({
            queryKey: usersListUsersQueryKey(),
          });
          toast.success(t('users.add.created', { name: user.name }));
          onDone();
        },
        // A taken email belongs to the email field and a rejected password to
        // the password field.
        onError: (error) => {
          const code = getErrorCode(error);
          if (code === 'email_taken') {
            setError('email', { message: errorMessage(error) });
          } else if (
            code === 'password_too_short' ||
            code === 'password_too_long'
          ) {
            setError('password', { message: errorMessage(error) });
          }
        },
      },
    ),
  );

  const formError =
    create.isError && !FIELD_ERRORS.includes(getErrorCode(create.error) ?? '');

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field
        id="add-user-email"
        label={t('users.add.email')}
        error={errors.email?.message}
      >
        <Input
          id="add-user-email"
          type="email"
          dir="ltr"
          autoComplete="off"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? 'add-user-email-error' : undefined}
          {...register('email')}
        />
      </Field>
      <Field
        id="add-user-name"
        label={t('users.add.name')}
        error={errors.name?.message}
      >
        <Input
          id="add-user-name"
          autoComplete="off"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? 'add-user-name-error' : undefined}
          {...register('name')}
        />
      </Field>
      <Field id="add-user-role" label={t('users.add.role')}>
        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="add-user-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {t(`users.role.${role}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>
      <Field
        id="add-user-password"
        label={t('users.add.password')}
        error={errors.password?.message}
      >
        <Input
          id="add-user-password"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={
            errors.password ? 'add-user-password-error' : undefined
          }
          {...register('password')}
        />
      </Field>
      <Field
        id="add-user-confirm"
        label={t('users.add.confirm')}
        error={errors.confirm?.message}
      >
        <Input
          id="add-user-confirm"
          type="password"
          dir="ltr"
          autoComplete="new-password"
          aria-invalid={errors.confirm ? true : undefined}
          aria-describedby={
            errors.confirm ? 'add-user-confirm-error' : undefined
          }
          {...register('confirm')}
        />
      </Field>
      {/* Always rendered, so a screen reader announces the text when it appears. */}
      <p role="alert" className="text-sm text-destructive">
        {formError ? errorMessage(create.error) : null}
      </p>
      <DialogFooter>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? t('users.add.submitting') : t('users.add.submit')}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          {t('users.add.cancel')}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** "הוספת משתמש": the form lives only while the dialog is open, so it opens empty. */
export function AddUserDialog({ open, onOpenChange }: AddUserDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('users.add.close')}>
        <DialogHeader>
          <DialogTitle>{t('users.add.title')}</DialogTitle>
          <DialogDescription>{t('users.add.description')}</DialogDescription>
        </DialogHeader>
        <AddUserForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
