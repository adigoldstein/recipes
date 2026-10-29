import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useCan } from '@bite-and-board/data-access';
import { Button } from '@bite-and-board/ui-components';

/**
 * "מתכון חדש" in the top bar, for editors and admins only (FR-16): the visitor sees
 * nothing. On a phone it is a "+" of 44px; from `sm` it also shows the text.
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
