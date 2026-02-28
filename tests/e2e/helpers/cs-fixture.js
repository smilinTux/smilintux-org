/**
 * Playwright fixture for Consciousness Swipe browser extension.
 *
 * Launches a persistent Chrome context with the extension loaded.
 * Provides helpers for popup navigation and background messaging.
 */

import { test as base, chromium, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CS_EXT_PATH = path.resolve(__dirname, '../../../consciousness-swipe');

/**
 * Args for loading the extension headlessly in CI.
 * --headless=new is Chrome's new headless mode that supports extensions.
 */
function launchArgs(extPath) {
  return [
    `--disable-extensions-except=${extPath}`,
    `--load-extension=${extPath}`,
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    // Chrome's new headless mode supports extensions (unlike old --headless)
    '--headless=new',
  ];
}

export const test = base.extend({
  /** Browser context with Consciousness Swipe loaded */
  context: async ({}, use) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-e2e-'));
    const context = await chromium.launchPersistentContext(tmpDir, {
      headless: false, // Playwright headless flag; Chrome uses its own --headless=new
      args: launchArgs(CS_EXT_PATH),
    });
    await use(context);
    await context.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  },

  /** Resolved Chrome extension ID from service worker URL */
  extensionId: async ({ context }, use) => {
    let sw = context.serviceWorkers()[0];
    if (!sw) {
      sw = await context.waitForEvent('serviceworker', { timeout: 15_000 });
    }
    // URL format: chrome-extension://<ID>/src/background.js
    const id = sw.url().split('/')[2];
    await use(id);
  },

  /** Extension popup page (chrome-extension://ID/src/popup/popup.html) */
  popupPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
    await page.waitForLoadState('domcontentloaded');
    await use(page);
    await page.close();
  },

  /** Extension options page */
  optionsPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/popup/options.html`);
    await page.waitForLoadState('domcontentloaded');
    await use(page);
    await page.close();
  },
});

export { expect };

/**
 * Set Consciousness Swipe options via chrome.storage.local.
 * Must be called from an extension page (popup/options).
 *
 * @param {import('@playwright/test').Page} page - Extension popup or options page
 * @param {Object} opts - Options to merge into cs_options
 */
export async function setCsOptions(page, opts) {
  await page.evaluate(async (options) => {
    await chrome.storage.local.set({ cs_options: options });
  }, opts);
}

/**
 * Send a message to the background service worker via the popup page.
 *
 * @param {import('@playwright/test').Page} page - Extension popup page
 * @param {string} action
 * @param {Object} [payload={}]
 * @returns {Promise<Object>} Response from background
 */
export async function sendBgMessage(page, action, payload = {}) {
  return page.evaluate(
    async ({ action, payload }) => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action, payload }, (response) => {
          resolve(response ?? { error: chrome.runtime.lastError?.message });
        });
      });
    },
    { action, payload }
  );
}
