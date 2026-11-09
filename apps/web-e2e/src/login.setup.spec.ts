import { expect, test as setup } from '@playwright/test';
import { E2E_AUTH_FILE, E2E_EMAIL, E2E_PASSWORD } from './test-account';

setup('log in as the editor', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('אימייל').fill(E2E_EMAIL);
  await page.getByLabel('סיסמה').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'כניסה' }).click();
  await expect(page.getByRole('link', { name: 'מתכון חדש' })).toBeVisible();
  await page.context().storageState({ path: E2E_AUTH_FILE });
});
