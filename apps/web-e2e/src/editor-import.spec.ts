import { expect, test } from '@playwright/test';
import { E2E_AUTH_FILE } from './test-account';

test.use({ storageState: E2E_AUTH_FILE });

// Flow 2: an editor imports a pasted recipe, fills in the missing fields and saves.
test('an editor imports a draft, fills the gaps and saves it', async ({
  page,
}) => {
  await page.goto('/recipes/new');
  await page.getByText('ייבוא עם בינה מלאכותית').click();
  await page.getByText('הדבקת טקסט').click();
  await page.getByLabel('טקסט המתכון').fill('FAKE:imperial');
  await page.getByRole('button', { name: 'יצירת טיוטה' }).click();

  await expect(
    page.getByRole('status', { name: 'בדיקת הטיוטה' }),
  ).toContainText('3 שדות דורשים השלמה');
  await expect(page.getByLabel('שם המתכון')).toHaveValue('לחם בית');

  await page.getByLabel('מספר מנות').fill('6');
  await page.getByLabel('זמן הכנה בדקות').fill('20');
  await page.getByLabel('זמן בישול בדקות').fill('40');
  await page.getByRole('button', { name: 'שמירה' }).click();

  await expect(page.getByRole('heading', { name: 'לחם בית' })).toBeVisible();
  await page.goto('/');
  await expect(
    page.getByRole('link', { name: 'לחם בית' }).first(),
  ).toBeVisible();
});
