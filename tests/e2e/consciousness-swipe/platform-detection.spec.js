/**
 * E2E tests — Consciousness Swipe platform detection.
 *
 * Tests that the detector.js content script correctly identifies AI platforms
 * from URL hostname (primary) and DOM fingerprints (fallback), fires the
 * 'cs:platform-detected' custom event, and exposes window.__csPlatform.
 *
 * Because content scripts only auto-inject on matching host_permissions URLs,
 * we load the detector script manually into mock pages via page.addScriptTag().
 */

import { test, expect } from '../helpers/cs-fixture.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../fixtures');
const CS_ROOT = path.resolve(__dirname, '../../../consciousness-swipe');
const DETECTOR_PATH = path.join(CS_ROOT, 'src/content/detector.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Load a fixture HTML page, inject detector.js, and return the detected platform info.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} fixture - Filename in fixtures/
 * @param {string} [mockHostname] - Override window.location.hostname for detection
 */
async function detectOnPage(context, fixturePath, mockHostname = null) {
  const page = await context.newPage();
  try {
    await page.goto(`file://${fixturePath}`);

    if (mockHostname) {
      // Override location.hostname so the HOSTNAME_MAP lookup works
      await page.evaluate((hostname) => {
        Object.defineProperty(window.location, 'hostname', {
          configurable: true,
          value: hostname,
        });
      }, mockHostname);
    }

    // Listen for the custom event BEFORE injecting the script
    await page.evaluate(() => {
      window.__platformEvents = [];
      document.addEventListener('cs:platform-detected', (e) => {
        window.__platformEvents.push(e.detail);
      });
    });

    // Inject detector.js (runs immediately on injection)
    await page.addScriptTag({ path: DETECTOR_PATH });

    // Collect results
    return await page.evaluate(() => ({
      platformInfo: window.__csPlatform,
      events: window.__platformEvents,
    }));
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Platform detection — hostname-based (primary)', () => {
  test('detects chatgpt.com', async ({ context }) => {
    const { platformInfo, events } = await detectOnPage(
      context,
      `${FIXTURES}/chatgpt-mock.html`,
      'chatgpt.com'
    );
    expect(platformInfo.platform).toBe('chatgpt');
    expect(platformInfo.url).toBeTruthy();
    expect(events).toHaveLength(1);
    expect(events[0].platform).toBe('chatgpt');
  });

  test('detects chat.openai.com', async ({ context }) => {
    const { platformInfo } = await detectOnPage(
      context,
      `${FIXTURES}/chatgpt-mock.html`,
      'chat.openai.com'
    );
    expect(platformInfo.platform).toBe('chatgpt');
  });

  test('detects claude.ai', async ({ context }) => {
    const { platformInfo } = await detectOnPage(
      context,
      `${FIXTURES}/claude-mock.html`,
      'claude.ai'
    );
    expect(platformInfo.platform).toBe('claude');
  });

  test('detects gemini.google.com', async ({ context }) => {
    const { platformInfo } = await detectOnPage(
      context,
      `${FIXTURES}/gemini-mock.html`,
      'gemini.google.com'
    );
    expect(platformInfo.platform).toBe('gemini');
  });

  test('detects cursor.com', async ({ context }) => {
    const page = await context.newPage();
    try {
      // Create minimal cursor DOM inline
      await page.setContent(`<!DOCTYPE html><html><body>
        <div data-testid="cursor-chat-panel">Chat</div>
      </body></html>`);
      await page.evaluate(() => {
        Object.defineProperty(window.location, 'hostname', {
          configurable: true,
          value: 'cursor.com',
        });
        window.__platformEvents = [];
        document.addEventListener('cs:platform-detected', (e) => {
          window.__platformEvents.push(e.detail);
        });
      });
      await page.addScriptTag({ path: DETECTOR_PATH });
      const result = await page.evaluate(() => window.__csPlatform);
      expect(result.platform).toBe('cursor');
    } finally {
      await page.close();
    }
  });
});

test.describe('Platform detection — DOM-based fallback', () => {
  test('falls back to DOM for claude when hostname is localhost', async ({ context }) => {
    const page = await context.newPage();
    try {
      // Mock Claude DOM fingerprints without matching hostname
      await page.setContent(`<!DOCTYPE html><html><body>
        <div data-testid="user-message">Hello</div>
        <div class="font-claude-message">World</div>
      </body></html>`);
      await page.evaluate(() => {
        window.__platformEvents = [];
        document.addEventListener('cs:platform-detected', (e) => {
          window.__platformEvents.push(e.detail);
        });
      });
      await page.addScriptTag({ path: DETECTOR_PATH });
      const result = await page.evaluate(() => window.__csPlatform);
      // Localhost hostname doesn't match, falls back to DOM which finds claude selectors
      expect(result.platform).toBe('claude');
    } finally {
      await page.close();
    }
  });

  test('falls back to DOM for chatgpt when hostname is unknown', async ({ context }) => {
    const page = await context.newPage();
    try {
      await page.setContent(`<!DOCTYPE html><html><body>
        <div data-message-author-role="user">Hello</div>
        <div data-message-author-role="assistant">Hi</div>
        <script id="__NEXT_DATA__" type="application/json">{}</script>
      </body></html>`);
      await page.evaluate(() => {
        window.__platformEvents = [];
        document.addEventListener('cs:platform-detected', (e) => {
          window.__platformEvents.push(e.detail);
        });
      });
      await page.addScriptTag({ path: DETECTOR_PATH });
      const result = await page.evaluate(() => window.__csPlatform);
      expect(result.platform).toBe('chatgpt');
    } finally {
      await page.close();
    }
  });

  test('returns unknown for unrecognized page', async ({ context }) => {
    const page = await context.newPage();
    try {
      await page.setContent(`<!DOCTYPE html><html><body>
        <h1>Just a regular page</h1>
        <p>No AI platform markers here.</p>
      </body></html>`);
      await page.evaluate(() => {
        window.__platformEvents = [];
        document.addEventListener('cs:platform-detected', (e) => {
          window.__platformEvents.push(e.detail);
        });
      });
      await page.addScriptTag({ path: DETECTOR_PATH });
      const result = await page.evaluate(() => window.__csPlatform);
      expect(result.platform).toBe('unknown');
    } finally {
      await page.close();
    }
  });
});

test.describe('Platform detection — event and window exposure', () => {
  test('fires cs:platform-detected custom event exactly once', async ({ context }) => {
    const page = await context.newPage();
    try {
      await page.setContent(`<!DOCTYPE html><html><body>
        <div data-testid="user-message">Test</div>
      </body></html>`);
      await page.evaluate(() => {
        window.__eventCount = 0;
        document.addEventListener('cs:platform-detected', () => {
          window.__eventCount++;
        });
      });
      await page.addScriptTag({ path: DETECTOR_PATH });
      const count = await page.evaluate(() => window.__eventCount);
      expect(count).toBe(1);
    } finally {
      await page.close();
    }
  });

  test('event detail matches window.__csPlatform', async ({ context }) => {
    const page = await context.newPage();
    try {
      await page.setContent(`<!DOCTYPE html><html><body>
        <div data-testid="user-message">Hello</div>
      </body></html>`);
      await page.evaluate(() => {
        window.__eventDetail = null;
        document.addEventListener('cs:platform-detected', (e) => {
          window.__eventDetail = e.detail;
        });
      });
      await page.addScriptTag({ path: DETECTOR_PATH });
      const { eventDetail, csPlatform } = await page.evaluate(() => ({
        eventDetail: window.__eventDetail,
        csPlatform: window.__csPlatform,
      }));
      expect(eventDetail.platform).toBe(csPlatform.platform);
      expect(eventDetail.version).toBe(csPlatform.version);
    } finally {
      await page.close();
    }
  });

  test('platform info includes version and url fields', async ({ context }) => {
    const page = await context.newPage();
    try {
      await page.setContent(`<!DOCTYPE html><html><body>
        <div class="font-claude-message">AI</div>
        <button data-testid="model-selector-trigger">Claude Sonnet</button>
      </body></html>`);
      await page.addScriptTag({ path: DETECTOR_PATH });
      const info = await page.evaluate(() => window.__csPlatform);
      expect(info).toHaveProperty('platform');
      expect(info).toHaveProperty('version');
      expect(info).toHaveProperty('url');
    } finally {
      await page.close();
    }
  });
});

test.describe('Platform version detection', () => {
  test('detects model name for claude when selector present', async ({ context }) => {
    const page = await context.newPage();
    try {
      await page.setContent(`<!DOCTYPE html><html><body>
        <div class="font-claude-message">Response</div>
        <button data-testid="model-selector-trigger">Claude Opus 4</button>
      </body></html>`);
      await page.addScriptTag({ path: DETECTOR_PATH });
      const info = await page.evaluate(() => window.__csPlatform);
      expect(info.version).toBe('Claude Opus 4');
    } finally {
      await page.close();
    }
  });

  test('returns unknown version when model selector absent', async ({ context }) => {
    const page = await context.newPage();
    try {
      await page.setContent(`<!DOCTYPE html><html><body>
        <div class="font-claude-message">Response</div>
      </body></html>`);
      await page.addScriptTag({ path: DETECTOR_PATH });
      const info = await page.evaluate(() => window.__csPlatform);
      expect(info.platform).toBe('claude');
      expect(info.version).toBe('unknown');
    } finally {
      await page.close();
    }
  });
});
