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
  FormField,
  Input,
  RequiredNote,
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
      <RequiredNote>{t('form.requiredNote')}</RequiredNote>
      <FormField
        id="add-user-email"
        label={t('users.add.email')}
        required
        error={errors.email?.message}
      >
        {(field) => (
          <Input
            type="email"
            dir="ltr"
            autoComplete="off"
            {...field}
            {...register('email')}
          />
        )}
      </FormField>
      <FormField
        id="add-user-name"
        label={t('users.add.name')}
        required
        error={errors.name?.message}
      >
        {(field) => (
          <Input autoComplete="off" {...field} {...register('name')} />
        )}
      </FormField>
      <FormField id="add-user-role" label={t('users.add.role')}>
        {() => (
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
        )}
      </FormField>
      <FormField
        id="add-user-password"
        label={t('users.add.password')}
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
        id="add-user-confirm"
        label={t('users.add.confirm')}
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
