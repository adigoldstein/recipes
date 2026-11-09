import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useCan } from '@bite-and-board/data-access';
import { Button } from '@bite-and-board/ui-components';

/**
 * The "מתכון חדש" button in the top bar, only for editors and admins (FR-16). A
 * visitor sees nothing. On a phone it is a 44px "+". From `sm` it also shows the text.
 */
export function NewRecipeButton() {
  const { t } = useTranslation();
  if (!useCan('editor')) return null;
  return (
    <Button asChild className="max-sm:size-11 max-sm:px-0">
      <Link to="/recipes/new">
        <Plus aria-hidden="true" />
        <span className="max-sm:sr-only">{t('recipeForm.newAction')}</span>
      </Link>
    </Button>
  );
}
