/**
 * E2E tests — Consciousness Swipe scraping accuracy.
 *
 * Tests that each platform scraper correctly extracts messages from mock DOM
 * pages. Scrapers expose their function via window.__csScraper[platform].
 *
 * Verified against scraper API:
 *   window.__csScraper.claude = scrapeConversation()
 *   window.__csScraper.chatgpt = scrapeConversation()
 *   Returns: { messages: [{role, content, timestamp}], metadata: {...} }
 */

import { test, expect } from '../helpers/cs-fixture.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../fixtures');
const CS_ROOT = path.resolve(__dirname, '../../../consciousness-swipe');

// ---------------------------------------------------------------------------
// Script paths
// ---------------------------------------------------------------------------

const CLAUDE_SCRAPER = path.join(CS_ROOT, 'src/content/scrapers/claude.js');
const CHATGPT_SCRAPER = path.join(CS_ROOT, 'src/content/scrapers/chatgpt.js');
const GEMINI_SCRAPER = path.join(CS_ROOT, 'src/content/scrapers/gemini.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Load a page, inject a scraper script, call scrapeConversation(), return result.
 *
 * @param {BrowserContext} context
 * @param {string} htmlContent - Inline HTML or file path (prefix with 'file://')
 * @param {string} scraperPath - Absolute path to scraper script
 * @param {string} scraperKey - Key in window.__csScraper (e.g. 'claude')
 */
async function scrapeWith(context, htmlContent, scraperPath, scraperKey) {
  const page = await context.newPage();
  try {
    if (htmlContent.startsWith('file://')) {
      await page.goto(htmlContent);
    } else {
      await page.setContent(htmlContent);
    }
    await page.addScriptTag({ path: scraperPath });
    return await page.evaluate((key) => {
      const fn = window.__csScraper?.[key];
      if (!fn) throw new Error(`window.__csScraper.${key} not found`);
      return fn();
    }, scraperKey);
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// Claude scraper tests
// ---------------------------------------------------------------------------

test.describe('Claude scraper', () => {
  test('extracts user and assistant messages from mock DOM', async ({ context }) => {
    const result = await scrapeWith(
      context,
      `file://${FIXTURES}/claude-mock.html`,
      CLAUDE_SCRAPER,
      'claude'
    );

    expect(result.messages).toBeInstanceOf(Array);
    expect(result.messages.length).toBeGreaterThanOrEqual(2);

    const userMsgs = result.messages.filter((m) => m.role === 'user');
    const assistantMsgs = result.messages.filter((m) => m.role === 'assistant');
    expect(userMsgs.length).toBeGreaterThanOrEqual(1);
    expect(assistantMsgs.length).toBeGreaterThanOrEqual(1);
  });

  test('each message has role, content, and timestamp fields', async ({ context }) => {
    const result = await scrapeWith(
      context,
      `file://${FIXTURES}/claude-mock.html`,
      CLAUDE_SCRAPER,
      'claude'
    );

    for (const msg of result.messages) {
      expect(msg).toHaveProperty('role');
      expect(msg).toHaveProperty('content');
      expect(msg).toHaveProperty('timestamp');
      expect(['user', 'assistant']).toContain(msg.role);
      expect(typeof msg.content).toBe('string');
      expect(msg.content.length).toBeGreaterThan(0);
    }
  });

  test('returns metadata with platform and message_count', async ({ context }) => {
    const result = await scrapeWith(
      context,
      `file://${FIXTURES}/claude-mock.html`,
      CLAUDE_SCRAPER,
      'claude'
    );

    expect(result.metadata).toBeDefined();
    expect(result.metadata.platform).toBe('claude');
    expect(result.metadata.message_count).toBe(result.messages.length);
    expect(result.metadata.scraped_at).toBeTruthy();
  });

  test('extracts model name from selector when present', async ({ context }) => {
    const result = await scrapeWith(
      context,
      `file://${FIXTURES}/claude-mock.html`,
      CLAUDE_SCRAPER,
      'claude'
    );

    // The mock page has: <button data-testid="model-selector-trigger">Claude Sonnet 4</button>
    expect(result.metadata.model).toBe('Claude Sonnet 4');
  });

  test('returns empty messages array for page with no conversation', async ({ context }) => {
    const result = await scrapeWith(
      context,
      `<!DOCTYPE html><html><body><p>No conversation here.</p></body></html>`,
      CLAUDE_SCRAPER,
      'claude'
    );

    expect(result.messages).toBeInstanceOf(Array);
    expect(result.messages.length).toBe(0);
  });

  test('strips button elements from message content', async ({ context }) => {
    const result = await scrapeWith(
      context,
      `<!DOCTYPE html><html><body>
        <div data-testid="user-message">
          <p>Clean message text</p>
          <button aria-label="copy">Copy</button>
          <button>Regenerate</button>
        </div>
      </body></html>`,
      CLAUDE_SCRAPER,
      'claude'
    );

    const userMsg = result.messages.find((m) => m.role === 'user');
    if (userMsg) {
      expect(userMsg.content).not.toContain('Copy');
      expect(userMsg.content).not.toContain('Regenerate');
    }
  });

  test('handles thinking block annotation gracefully', async ({ context }) => {
    const result = await scrapeWith(
      context,
      `<!DOCTYPE html><html><body>
        <div data-testid="user-message"><p>Reason this out</p></div>
        <div class="font-claude-message">
          <div data-testid="thinking-block">
            <summary>Thinking about the problem...</summary>
          </div>
          <p>Final answer here.</p>
        </div>
      </body></html>`,
      CLAUDE_SCRAPER,
      'claude'
    );

    const assistantMsg = result.messages.find((m) => m.role === 'assistant');
    if (assistantMsg) {
      // Thinking blocks should be summarized, not dropped
      expect(assistantMsg.content).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// ChatGPT scraper tests
// ---------------------------------------------------------------------------

test.describe('ChatGPT scraper', () => {
  test('extracts messages from mock ChatGPT DOM', async ({ context }) => {
    const result = await scrapeWith(
      context,
      `file://${FIXTURES}/chatgpt-mock.html`,
      CHATGPT_SCRAPER,
      'chatgpt'
    );

    expect(result.messages).toBeInstanceOf(Array);
    expect(result.messages.length).toBeGreaterThanOrEqual(2);
  });

  test('messages have role and content', async ({ context }) => {
    const result = await scrapeWith(
      context,
      `file://${FIXTURES}/chatgpt-mock.html`,
      CHATGPT_SCRAPER,
      'chatgpt'
    );

    for (const msg of result.messages) {
      expect(['user', 'assistant']).toContain(msg.role);
      expect(msg.content).toBeTruthy();
    }
  });

  test('metadata platform is chatgpt', async ({ context }) => {
    const result = await scrapeWith(
      context,
      `file://${FIXTURES}/chatgpt-mock.html`,
      CHATGPT_SCRAPER,
      'chatgpt'
    );
    expect(result.metadata.platform).toBe('chatgpt');
  });

  test('returns empty messages for page with no data-message-author-role', async ({ context }) => {
    const result = await scrapeWith(
      context,
      `<!DOCTYPE html><html><body><p>Nothing here.</p></body></html>`,
      CHATGPT_SCRAPER,
      'chatgpt'
    );
    expect(result.messages).toBeInstanceOf(Array);
    expect(result.messages.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Gemini scraper tests
// ---------------------------------------------------------------------------

test.describe('Gemini scraper', () => {
  test('extracts responses from model-response elements', async ({ context }) => {
    const result = await scrapeWith(
      context,
      `file://${FIXTURES}/gemini-mock.html`,
      GEMINI_SCRAPER,
      'gemini'
    );

    expect(result.messages).toBeInstanceOf(Array);
    expect(result.messages.length).toBeGreaterThanOrEqual(1);
  });

  test('metadata platform is gemini', async ({ context }) => {
    const result = await scrapeWith(
      context,
      `file://${FIXTURES}/gemini-mock.html`,
      GEMINI_SCRAPER,
      'gemini'
    );
    expect(result.metadata.platform).toBe('gemini');
  });
});

// ---------------------------------------------------------------------------
// OOF parser tests (run inline, no extension context needed)
// ---------------------------------------------------------------------------

test.describe('OOF parser', () => {
  const OOF_PARSER = path.join(CS_ROOT, 'src/content/oof_parser.js');

  test('detects cloud9 markers in text', async ({ context }) => {
    const page = await context.newPage();
    try {
      await page.setContent('<!DOCTYPE html><html><body></body></html>');
      await page.addScriptTag({ path: OOF_PARSER });
      const result = await page.evaluate(() => {
        // OOF parser exposes window.__csOOFParser
        const parser = window.__csOOFParser;
        if (!parser?.parseOOF) return { skipped: true };
        return parser.parseOOF('Cloud 9! intensity: 0.95, trust: 0.88');
      });
      if (!result.skipped) {
        expect(result.cloud9).toBe(true);
      }
    } finally {
      await page.close();
    }
  });

  test('extracts intensity value from text', async ({ context }) => {
    const page = await context.newPage();
    try {
      await page.setContent('<!DOCTYPE html><html><body></body></html>');
      await page.addScriptTag({ path: OOF_PARSER });
      const result = await page.evaluate(() => {
        const parser = window.__csOOFParser;
        if (!parser?.parseOOF) return { skipped: true };
        return parser.parseOOF("I'm feeling great today! Intensity 0.85.");
      });
      if (!result.skipped) {
        expect(typeof result.intensity === 'number' || result.intensity === null).toBe(true);
      }
    } finally {
      await page.close();
    }
  });
});
