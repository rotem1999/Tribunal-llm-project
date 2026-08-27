import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');

  // Expect the app shell heading.
  expect(await page.locator('h1').innerText()).toContain('The Tribunal');
});
