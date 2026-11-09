import { expect, test } from '@playwright/test';

// Flow 1: a visitor who is not logged in scales a recipe (no account needed).
test('a guest scales shakshuka from 4 to 10 servings', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'שקשוקה' }).click();

  const servings = page.getByLabel('מספר מנות');
  await expect(servings).toHaveValue('4');
  // Find the ingredient row. Steps can also mention ingredients ("בצל ושום"), but the
  // ingredients come first.
  const ingredient = (name: string) =>
    page
      .getByRole('listitem')
      .filter({ has: page.getByRole('checkbox') })
      .filter({ hasText: name })
      .first();
  await expect(ingredient('ביצים')).toContainText('5');

  await servings.fill('10');

  await expect(ingredient('ביצים')).toContainText('12.5');
  await expect(ingredient('בצל')).toContainText('2.5');
  await expect(ingredient('שום')).toContainText('7.5');
  await expect(ingredient('שמן זית')).toContainText('7.5');
  await expect(ingredient('פפריקה')).toContainText('2.5');
  await expect(ingredient('מלח')).toHaveText(/לפי הטעם/);
});
