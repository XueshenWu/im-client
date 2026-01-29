/**
 * Script to launch Electron app with Playwright Inspector for recording
 * Usage: npx tsx e2e/record-electron.ts
 */
import { _electron as electron } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function recordElectron() {
  console.log('Launching Electron app with Playwright Inspector...');
  console.log('');
  console.log('Instructions:');
  console.log('1. Interact with the app - actions will be recorded');
  console.log('2. Copy generated code from the Inspector panel');
  console.log('3. Press Ctrl+C to stop recording');
  console.log('');

  // Launch Electron with PWDEBUG to open Inspector
  const electronApp = await electron.launch({
    args: [path.join(__dirname, '../dist-electron/main.js')],
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PWDEBUG: '1', // Opens Playwright Inspector
    },
  });

  const page = await electronApp.firstWindow();

  // Keep the app running until user closes it
  await page.waitForEvent('close', { timeout: 0 }).catch(() => {});

  await electronApp.close();
  console.log('Recording session ended.');
}

recordElectron().catch(console.error);
