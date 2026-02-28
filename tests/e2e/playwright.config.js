import { defineConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../..');

export const CS_EXT_PATH = path.join(ROOT, 'consciousness-swipe');
export const CAPAUTH_EXT_PATH = path.join(ROOT, 'capauth/browser-extension');

export default defineConfig({
  testDir: '.',
  // Extensions require serial execution — no parallel browser instances
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 30_000,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ...(process.env.CI ? [['github']] : []),
  ],
  projects: [
    {
      name: 'consciousness-swipe',
      testDir: './consciousness-swipe',
    },
    {
      name: 'capauth',
      testDir: './capauth',
    },
  ],
});
