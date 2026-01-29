import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';

let electronApp: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  // Launch Electron app
  electronApp = await electron.launch({
    args: [path.join(__dirname, '../dist-electron/main.js')],
    cwd: path.join(__dirname, '..'),
  });

  // Wait for the first window to open
  page = await electronApp.firstWindow();

  // Wait for app to be ready
  await page.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  await electronApp.close();
});

test.describe('Electron App', () => {
  test('should launch and show main window', async () => {
    // Check window title
    const title = await page.title();
    expect(title).toBeTruthy();

    // Verify the app loaded
    const isVisible = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      return mainWindow.isVisible();
    });
    expect(isVisible).toBe(true);
  });

  test('should have access to electronAPI in renderer', async () => {
    // Check if electronAPI is exposed to renderer
    const hasElectronAPI = await page.evaluate(() => {
      return typeof (window as any).electronAPI !== 'undefined';
    });
    expect(hasElectronAPI).toBe(true);
  });

  test('should navigate to gallery page', async () => {
    // The app redirects to gallery by default
    await page.waitForURL(/#\/gallery/);
    const url = page.url();
    expect(url).toContain('#/gallery');
  });

  test('should navigate to settings page', async () => {
    // Click on settings link/button in the sidebar
    await page.click('a[href="#/settings"], [data-testid="settings-link"]');
    await page.waitForURL(/#\/settings/);
    expect(page.url()).toContain('#/settings');
  });
});

// Example: Testing IPC communication
test.describe('Electron IPC', () => {
  test('should communicate with main process', async () => {
    // Example: Test database initialization via IPC
    const dbResult = await page.evaluate(async () => {
      const result = await (window as any).electronAPI?.db?.initialize();
      return result;
    });

    // Verify IPC worked (adjust based on your actual API)
    expect(dbResult).toBeDefined();
  });
});
