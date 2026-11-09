import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { E2E_AUTH_FILE } from './test-account';

// Only the violations that block people (serious and critical) fail the build.
async function expectNoBlockingViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const blocking = violations.filter(
    (violation) =>
      violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(
    blocking.map((violation) => `${violation.id}: ${violation.help}`),
  ).toEqual([]);
}

test('the library has no serious accessibility violations', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'שקשוקה' })).toBeVisible();
  await expectNoBlockingViolations(page);
});

test('a recipe page has no serious accessibility violations', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'שקשוקה' }).click();
  await expect(page.getByRole('heading', { name: 'שקשוקה' })).toBeVisible();
  await expectNoBlockingViolations(page);
});

test.describe('signed in', () => {
  test.use({ storageState: E2E_AUTH_FILE });

  test('the recipe form has no serious accessibility violations', async ({
    page,
  }) => {
    await page.goto('/recipes/new');
    await expect(page.getByLabel('שם המתכון')).toBeVisible();
    await expectNoBlockingViolations(page);
  });
});
