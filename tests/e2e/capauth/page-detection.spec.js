/**
 * E2E tests — CapAuth page detection and button injection.
 *
 * Tests that detector.js correctly identifies CapAuth-enabled pages using
 * all three detection methods:
 *   1. [data-capauth] attribute
 *   2. <meta name="capauth-service">
 *   3. <link rel="capauth">
 *
 * And injects the "Sign in with CapAuth" button on positive matches,
 * while leaving non-CapAuth pages untouched.
 *
 * Content scripts only auto-inject on *.capauth.io and *.skworld.io.
 * For localhost mock pages, we inject detector.js manually.
 */

import { test, expect } from '../helpers/capauth-fixture.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../fixtures');
const CAPAUTH_ROOT = path.resolve(__dirname, '../../../capauth/browser-extension');
const DETECTOR_PATH = path.join(CAPAUTH_ROOT, 'content_scripts/detector.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Inject detector.js into a page and mock chrome.runtime.sendMessage to
 * capture calls (the real runtime won't be available in content-script mode).
 */
async function injectDetector(page) {
  // Mock chrome API for content script
  await page.evaluate(() => {
    window.__chromeMsgCalls = [];
    if (!window.chrome) {
      window.chrome = {
        runtime: {
          sendMessage: (msg, cb) => {
            window.__chromeMsgCalls.push(msg);
            if (cb) cb({ success: true });
          },
          onMessage: {
            addListener: () => {},
          },
          lastError: null,
        },
      };
    }
  });

  await page.addScriptTag({ path: DETECTOR_PATH });

  // Give the script a moment to finish DOM mutation observation
  await page.waitForTimeout(200);
}

// ---------------------------------------------------------------------------
// Tests: data-capauth attribute
// ---------------------------------------------------------------------------

test.describe('Detection method 1: data-capauth attribute', () => {
  test('detects CapAuth via data-capauth attribute', async ({ context }) => {
    const page = await context.newPage();
    try {
      await page.goto(`file://${FIXTURES}/capauth-data-attr.html`);
      await injectDetector(page);

      const detected = await page.evaluate(() => window.__capauth);
      expect(detected).toBeDefined();
      expect(detected.detected).toBe(true);
      expect(detected.method).toBe('data-attribute');
      expect(detected.serviceUrl).toBe('https://auth.skworld.io');
    } finally {
      await page.close();
    }
  });

  test('injects Sign in with CapAuth button after target element', async ({ context }) => {
    const page = await context.newPage();
    try {
      await page.goto(`file://${FIXTURES}/capauth-data-attr.html`);
      await injectDetector(page);

      const buttonExists = await page.locator('#capauth-signin-btn').isVisible();
      expect(buttonExists).toBe(true);
    } finally {
      await page.close();
    }
  });

  test('button text is Sign in with CapAuth', async ({ context }) => {
    const page = await context.newPage();
    try {
      await page.goto(`file://${FIXTURES}/capauth-data-attr.html`);
      await injectDetector(page);

      const btnText = await page.locator('#capauth-signin-btn span').textContent();
      expect(btnText).toBe('Sign in with CapAuth');
    } finally {
      await page.close();
    }
  });

  test('capauth-container wraps button and status text', async ({ context }) => {
    const page = await context.newPage();
    try {
      await page.goto(`file://${FIXTURES}/capauth-data-attr.html`);
      await injectDetector(page);

      const container = await page.locator('#capauth-container').isVisible();
      const status = await page.locator('#capauth-status').isVisible();
      expect(container).toBe(true);
      expect(status).toBe(true);
    } finally {
      await page.close();
    }
  });

  test('status text shows Passwordless PGP authentication', async ({ context }) => {
    const page = await context.newPage();
    try {
      await page.goto(`file://${FIXTURES}/capauth-data-attr.html`);
      await injectDetector(page);

      const statusText = await page.locator('#capauth-status').textContent();
      expect(statusText).toBe('Passwordless PGP authentication');
    } finally {
      await page.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: meta-tag method
// ---------------------------------------------------------------------------

test.describe('Detection method 2: meta name="capauth-service"', () => {
  test('detects CapAuth via meta tag', async ({ context }) => {
    const page = await context.newPage();
    try {
      await page.goto(`file://${FIXTURES}/capauth-meta-tag.html`);
      await injectDetector(page);

      const detected = await page.evaluate(() => window.__capauth);
      expect(detected.detected).toBe(true);
      expect(detected.method).toBe('meta-tag');
      expect(detected.serviceUrl).toBe('https://auth.skworld.io');
    } finally {
      await page.close();
    }
  });

  test('injects button near login form when no target element', async ({ context }) => {
    const page = await context.newPage();
    try {
      await page.goto(`file://${FIXTURES}/capauth-meta-tag.html`);
      await injectDetector(page);

      const buttonExists = await page.locator('#capauth-signin-btn').count();
      expect(buttonExists).toBe(1);
    } finally {
      await page.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: link-tag method
// ---------------------------------------------------------------------------

test.describe('Detection method 3: link rel="capauth"', () => {
  test('detects CapAuth via link tag', async ({ context }) => {
    const page = await context.newPage();
    try {
      await page.goto(`file://${FIXTURES}/capauth-link-tag.html`);
      await injectDetector(page);

      const detected = await page.evaluate(() => window.__capauth);
      expect(detected.detected).toBe(true);
      expect(detected.method).toBe('link-tag');
    } finally {
      await page.close();
    }
  });

  test('button injected into page', async ({ context }) => {
    const page = await context.newPage();
    try {
      await page.goto(`file://${FIXTURES}/capauth-link-tag.html`);
      await injectDetector(page);

      expect(await page.locator('#capauth-signin-btn').count()).toBe(1);
    } finally {
      await page.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: non-CapAuth pages
// ---------------------------------------------------------------------------

test.describe('Non-CapAuth pages — no injection', () => {
  test('does NOT inject button on page without CapAuth markers', async ({ context }) => {
    const page = await context.newPage();
    try {
      await page.goto(`file://${FIXTURES}/no-capauth.html`);
      await injectDetector(page);

      const count = await page.locator('#capauth-signin-btn').count();
      expect(count).toBe(0);
    } finally {
      await page.close();
    }
  });

  test('window.__capauth is undefined on non-CapAuth page', async ({ context }) => {
    const page = await context.newPage();
    try {
      await page.goto(`file://${FIXTURES}/no-capauth.html`);
      await injectDetector(page);

      const capauth = await page.evaluate(() => window.__capauth);
      expect(capauth).toBeUndefined();
    } finally {
      await page.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: duplicate injection prevention
// ---------------------------------------------------------------------------

test.describe('Duplicate injection prevention', () => {
  test('injecting detector twice does not create two buttons', async ({ context }) => {
    const page = await context.newPage();
    try {
      await page.goto(`file://${FIXTURES}/capauth-data-attr.html`);
      await injectDetector(page);
      // Inject a second time
      await injectDetector(page);

      const count = await page.locator('#capauth-signin-btn').count();
      expect(count).toBe(1);
    } finally {
      await page.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: dynamic SPA injection via MutationObserver
// ---------------------------------------------------------------------------

test.describe('Dynamic SPA injection via MutationObserver', () => {
  test('injects button when data-capauth element added dynamically', async ({ context }) => {
    const page = await context.newPage();
    try {
      // Start with a blank page, inject detector first
      await page.setContent('<!DOCTYPE html><html><body><div id="app"></div></body></html>');
      await injectDetector(page);

      // Dynamically add the CapAuth element (simulating SPA route change)
      await page.evaluate(() => {
        const div = document.createElement('div');
        div.setAttribute('data-capauth', 'https://auth.skworld.io');
        div.setAttribute('data-capauth-redirect', '/dashboard');
        document.getElementById('app').appendChild(div);
      });

      // Wait for MutationObserver to fire and inject button
      await page.waitForSelector('#capauth-signin-btn', { timeout: 5000 });

      expect(await page.locator('#capauth-signin-btn').count()).toBe(1);
    } finally {
      await page.close();
    }
  });
});
