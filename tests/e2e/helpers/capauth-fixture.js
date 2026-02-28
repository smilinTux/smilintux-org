/**
 * Playwright fixture for the CapAuth browser extension.
 *
 * Launches a persistent Chrome context with the CapAuth extension loaded.
 * Provides helpers for popup navigation and background messaging.
 */

import { test as base, chromium, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CAPAUTH_EXT_PATH = path.resolve(
  __dirname,
  '../../../capauth/browser-extension'
);

function launchArgs(extPath) {
  return [
    `--disable-extensions-except=${extPath}`,
    `--load-extension=${extPath}`,
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--headless=new',
  ];
}

export const test = base.extend({
  /** Browser context with CapAuth loaded */
  context: async ({}, use) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'capauth-e2e-'));
    const context = await chromium.launchPersistentContext(tmpDir, {
      headless: false,
      args: launchArgs(CAPAUTH_EXT_PATH),
    });
    await use(context);
    await context.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  },

  /** Resolved Chrome extension ID */
  extensionId: async ({ context }, use) => {
    let sw = context.serviceWorkers()[0];
    if (!sw) {
      sw = await context.waitForEvent('serviceworker', { timeout: 15_000 });
    }
    const id = sw.url().split('/')[2];
    await use(id);
  },

  /** Extension popup page */
  popupPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);
    await page.waitForLoadState('domcontentloaded');
    await use(page);
    await page.close();
  },

  /** Extension options page */
  optionsPage: async ({ context, extensionId }, use) => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options/options.html`);
    await page.waitForLoadState('domcontentloaded');
    await use(page);
    await page.close();
  },
});

export { expect };

/**
 * Store CapAuth settings and a test PGP key in chrome.storage.local.
 * Must be called from an extension page.
 *
 * @param {import('@playwright/test').Page} page - Options or popup page
 * @param {Object} settings
 * @param {string} settings.fingerprint - PGP fingerprint (40-char hex)
 * @param {string} [settings.privateKeyArmored] - Armored PGP private key
 * @param {string} [settings.serviceUrl] - CapAuth service URL
 */
export async function storeCapAuthSettings(page, settings) {
  await page.evaluate(async (s) => {
    await chrome.storage.local.set({
      capauth_fingerprint: s.fingerprint,
      capauth_private_key: s.privateKeyArmored ?? null,
      capauth_service_url: s.serviceUrl ?? '',
    });
  }, settings);
}

/**
 * Store a pre-cached token in chrome.storage.local to simulate a prior auth.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} serviceUrl
 * @param {Object} tokenData - { access_token, expires_at (ISO string) }
 */
export async function storeCachedToken(page, serviceUrl, tokenData) {
  await page.evaluate(
    async ({ serviceUrl, tokenData }) => {
      const { capauth_token_cache = {} } = await chrome.storage.local.get(
        'capauth_token_cache'
      );
      capauth_token_cache[serviceUrl] = tokenData;
      await chrome.storage.local.set({ capauth_token_cache });
    },
    { serviceUrl, tokenData }
  );
}

/**
 * Send a message to the CapAuth background worker via popup page.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} action
 * @param {Object} [payload={}]
 * @returns {Promise<Object>}
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
