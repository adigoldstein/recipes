import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  FormField,
  PendingButton,
  Input,
  RequiredNote,
} from '@bite-and-board/ui-components';
import { useErrorMessage } from '../shared/use-error-message';
import { useCreateTag } from './use-tag-mutations';

// Matches the server (AD-24); the server stays the authority.
const TAG_NAME_MAX_LENGTH = 40;

/** The add field at the top of the Tags screen. */
export function AddTagForm() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const create = useCreateTag();
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<string>();

  const submit = (event: React.SyntheticEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setProblem(t('tags.add.required'));
      return;
    }
    if (trimmed.length > TAG_NAME_MAX_LENGTH) {
      setProblem(t('tags.add.tooLong', { max: TAG_NAME_MAX_LENGTH }));
      return;
    }
    setProblem(undefined);
    create.mutate(
      { body: { name: trimmed } },
      {
        onSuccess: () => setName(''),
        onError: (error) => setProblem(errorMessage(error)),
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <RequiredNote>{t('form.requiredNote')}</RequiredNote>
      <div className="flex items-start gap-3">
        <FormField
          id="new-tag"
          label={t('tags.add.label')}
          required
          error={problem}
          className="flex-1"
        >
          {(field) => (
            <Input
              {...field}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </FormField>
        <PendingButton
          type="submit"
          pending={create.isPending}
          pendingLabel={t('tags.add.submitting')}
          className="mt-7"
        >
          <Plus aria-hidden="true" />
          {t('tags.add.submit')}
        </PendingButton>
      </div>
    </form>
  );
}
