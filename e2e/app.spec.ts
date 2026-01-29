import { test, expect } from '@playwright/test';

test.describe('App Navigation', () => {
  test('should load the gallery page by default', async ({ page }) => {
    await page.goto('/');

    // The app redirects to #/gallery by default
    await expect(page).toHaveURL(/#\/gallery/);
  });

  test('should navigate to settings page', async ({ page }) => {
    await page.goto('/#/settings');

    await expect(page).toHaveURL(/#\/settings/);
  });

  test('should navigate to upload page', async ({ page }) => {
    await page.goto('/#/upload');

    await expect(page).toHaveURL(/#\/upload/);
  });

  test('should navigate to dashboard page', async ({ page }) => {
    await page.goto('/#/dashboard');

    await expect(page).toHaveURL(/#\/dashboard/);
  });
});
