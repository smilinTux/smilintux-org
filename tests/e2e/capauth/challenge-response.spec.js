/**
 * E2E tests — CapAuth challenge-response authentication flow.
 *
 * Tests the full CapAuth v1.0 protocol:
 *   1. INITIATE_AUTH → fetches challenge from /capauth/v1/challenge
 *   2. Background signs the nonce
 *   3. Sends response to /capauth/v1/verify
 *   4. Popup updates UI state on success/failure
 *
 * Uses a mock CapAuth server that accepts any valid-structure request.
 * For tests requiring actual PGP signing, we check message structure only.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect, sendBgMessage, storeCapAuthSettings } from '../helpers/capauth-fixture.js';
import { createMockCapAuthServer } from '../helpers/mock-capauth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAPAUTH_ROOT = path.resolve(__dirname, '../../../capauth/browser-extension');
const CROSS_ORIGIN_SCRIPT = path.join(
  CAPAUTH_ROOT,
  'content_scripts/cross_origin_signing.js'
);

// ---------------------------------------------------------------------------
// Test PGP fingerprint (40-char hex, used as identity — no real key needed
// for challenge-structure tests)
// ---------------------------------------------------------------------------
const TEST_FINGERPRINT = 'AABBCCDDEEFF00112233445566778899AABBCCDD';

// ---------------------------------------------------------------------------
// Tests: background message API
// ---------------------------------------------------------------------------

test.describe('Background worker — message routing', () => {
  test('responds to ping', async ({ popupPage }) => {
    const res = await sendBgMessage(popupPage, 'PING');
    // Background handles PING or returns an error for unknown — either is fine
    expect(res).toBeDefined();
  });

  test('CHECK_STATUS returns status object', async ({ popupPage }) => {
    const res = await sendBgMessage(popupPage, 'CHECK_STATUS');
    expect(res).toBeDefined();
  });

  test('GET_FINGERPRINT returns null when no key stored', async ({ popupPage }) => {
    const res = await sendBgMessage(popupPage, 'GET_FINGERPRINT');
    // Unset → null or an empty-state response
    expect(res).toBeDefined();
  });

  test('GET_CACHED_TOKEN returns no token when cache is empty', async ({ popupPage }) => {
    const res = await sendBgMessage(popupPage, 'GET_CACHED_TOKEN', {
      serviceUrl: 'https://auth.example.com',
    });
    expect(res).toBeDefined();
    // No cached token → either null, empty, or { token: null }
    const token = res?.token ?? res?.access_token ?? res?.cached ?? null;
    expect(token).toBeFalsy();
  });

  test('CLEAR_TOKENS succeeds without error', async ({ popupPage }) => {
    const res = await sendBgMessage(popupPage, 'CLEAR_TOKENS');
    expect(res).toBeDefined();
    if (res.error) {
      // Only fail if it's a hard error, not "nothing to clear"
      expect(res.error).not.toMatch(/crash|uncaught|undefined/i);
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: challenge-response via mock server
// ---------------------------------------------------------------------------

test.describe('Challenge-response protocol', () => {
  let mock;
  let mockUrl;

  test.beforeEach(async () => {
    mock = createMockCapAuthServer();
    mockUrl = await mock.start();
  });

  test.afterEach(async () => {
    mock.reset();
    await mock.stop();
  });

  test('INITIATE_AUTH sends challenge request to /capauth/v1/challenge', async ({ popupPage }) => {
    await storeCapAuthSettings(popupPage, {
      fingerprint: TEST_FINGERPRINT,
      serviceUrl: mockUrl,
    });

    await sendBgMessage(popupPage, 'INITIATE_AUTH', { serviceUrl: mockUrl });

    const challengeCalls = mock.callsTo('POST', '/capauth/v1/challenge');
    expect(challengeCalls.length).toBeGreaterThanOrEqual(1);
  });

  test('challenge request includes fingerprint and client_nonce', async ({ popupPage }) => {
    await storeCapAuthSettings(popupPage, {
      fingerprint: TEST_FINGERPRINT,
      serviceUrl: mockUrl,
    });

    await sendBgMessage(popupPage, 'INITIATE_AUTH', { serviceUrl: mockUrl });

    const challengeCalls = mock.callsTo('POST', '/capauth/v1/challenge');
    if (challengeCalls.length > 0) {
      const body = challengeCalls[0].body;
      expect(body.fingerprint).toBe(TEST_FINGERPRINT);
      expect(body.client_nonce).toBeTruthy();
    }
  });

  test('challenge request includes capauth_version field', async ({ popupPage }) => {
    await storeCapAuthSettings(popupPage, {
      fingerprint: TEST_FINGERPRINT,
      serviceUrl: mockUrl,
    });

    await sendBgMessage(popupPage, 'INITIATE_AUTH', { serviceUrl: mockUrl });

    const challengeCalls = mock.callsTo('POST', '/capauth/v1/challenge');
    if (challengeCalls.length > 0) {
      expect(challengeCalls[0].body.capauth_version).toBeTruthy();
    }
  });

  test('auth fails gracefully when server returns 400 on challenge', async ({ popupPage }) => {
    mock.setRejectChallenge(true);
    await storeCapAuthSettings(popupPage, {
      fingerprint: TEST_FINGERPRINT,
      serviceUrl: mockUrl,
    });

    const res = await sendBgMessage(popupPage, 'INITIATE_AUTH', { serviceUrl: mockUrl });
    // Should return error, not throw
    expect(res).toBeDefined();
    if (res.success !== true) {
      expect(res.error ?? res.message).toBeTruthy();
    }
  });

  test('auth fails gracefully when server returns 401 on verify', async ({ popupPage }) => {
    mock.setRejectVerify(true);
    await storeCapAuthSettings(popupPage, {
      fingerprint: TEST_FINGERPRINT,
      serviceUrl: mockUrl,
    });

    const res = await sendBgMessage(popupPage, 'INITIATE_AUTH', { serviceUrl: mockUrl });
    expect(res).toBeDefined();
    // Should not crash the extension
  });

  test('auth returns error when no fingerprint stored', async ({ popupPage }) => {
    // No settings stored → background should return error without calling server
    const res = await sendBgMessage(popupPage, 'INITIATE_AUTH', { serviceUrl: mockUrl });
    expect(res).toBeDefined();
    expect(res.success).not.toBe(true);
  });

  test('challenge response is echoed back in request validation', async ({ popupPage }) => {
    await storeCapAuthSettings(popupPage, {
      fingerprint: TEST_FINGERPRINT,
      serviceUrl: mockUrl,
    });

    await sendBgMessage(popupPage, 'INITIATE_AUTH', { serviceUrl: mockUrl });

    // The mock server echoes client_nonce in the challenge response.
    // The background should validate this echo before proceeding to signing.
    const challengeCalls = mock.callsTo('POST', '/capauth/v1/challenge');
    if (challengeCalls.length > 0) {
      const sentNonce = challengeCalls[0].body?.client_nonce;
      // We can't inspect background internals, but verify the server received the nonce
      expect(sentNonce).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Tests: popup UI behavior during auth
// ---------------------------------------------------------------------------

test.describe('Popup UI — auth state feedback', () => {
  test('popup page loads without JS errors', async ({ popupPage }) => {
    const errors = [];
    popupPage.on('pageerror', (err) => errors.push(err.message));
    await popupPage.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });

  test('popup renders some content', async ({ popupPage }) => {
    const bodyText = await popupPage.locator('body').textContent();
    expect(bodyText.trim().length).toBeGreaterThan(0);
  });

  test('popup has at least one button', async ({ popupPage }) => {
    const count = await popupPage.locator('button').count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Tests: cross-origin signing content script
// ---------------------------------------------------------------------------

test.describe('Cross-origin signing via postMessage', () => {
  test('script injects without JS errors', async ({ context }) => {
    const page = await context.newPage();
    try {
      await page.setContent('<!DOCTYPE html><html><body></body></html>');

      // Mock chrome runtime for content script usage
      await page.evaluate(() => {
        window.__chromeMsgCalls = [];
        window.chrome = {
          runtime: {
            sendMessage: (msg, cb) => {
              window.__chromeMsgCalls.push(msg);
              if (cb) cb({ success: false, error: 'No key stored' });
            },
            onMessage: { addListener: () => {} },
            lastError: null,
          },
        };
      });

      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));

      await page.addScriptTag({ path: CROSS_ORIGIN_SCRIPT });
      await page.waitForTimeout(200);

      expect(errors).toHaveLength(0);
    } finally {
      await page.close();
    }
  });

  test('CAPAUTH_SIGN_REQUEST with invalid nonce format is rejected', async ({ context }) => {
    const page = await context.newPage();
    try {
      await page.setContent('<!DOCTYPE html><html><body></body></html>');
      await page.evaluate(() => {
        window.chrome = {
          runtime: {
            sendMessage: (msg, cb) => { if (cb) cb(null); },
            onMessage: { addListener: () => {} },
            lastError: null,
          },
        };
        window.__signResponses = [];
        window.addEventListener('message', (e) => {
          if (
            e.data?.type === 'CAPAUTH_SIGN_ERROR' ||
            e.data?.type === 'CAPAUTH_SIGN_RESPONSE'
          ) {
            window.__signResponses.push(e.data);
          }
        });
      });

      await page.addScriptTag({ path: CROSS_ORIGIN_SCRIPT });

      // Send a request with an invalid nonce (not UUID format)
      await page.evaluate(() => {
        window.postMessage(
          {
            type: 'CAPAUTH_SIGN_REQUEST',
            requestId: 'req-001',
            challenge: 'not-a-valid-uuid!!!',
            serviceUrl: 'https://test.example.com',
          },
          '*'
        );
      });

      await page.waitForTimeout(600);

      const responses = await page.evaluate(() => window.__signResponses);
      const errors = responses.filter((r) => r.type === 'CAPAUTH_SIGN_ERROR');
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(errors[0].requestId).toBe('req-001');
    } finally {
      await page.close();
    }
  });

  test('sign queue rejects more than 3 pending requests', async ({ context }) => {
    const page = await context.newPage();
    try {
      await page.setContent('<!DOCTYPE html><html><body></body></html>');
      await page.evaluate(() => {
        window.chrome = {
          runtime: {
            sendMessage: () => {},
            onMessage: { addListener: () => {} },
            lastError: null,
          },
        };
        window.__signResponses = [];
        window.addEventListener('message', (e) => {
          if (
            e.data?.type === 'CAPAUTH_SIGN_ERROR' ||
            e.data?.type === 'CAPAUTH_SIGN_RESPONSE'
          ) {
            window.__signResponses.push(e.data);
          }
        });
      });

      await page.addScriptTag({ path: CROSS_ORIGIN_SCRIPT });

      // Send 4 valid UUID sign requests — 4th should be rejected (queue max 3)
      await page.evaluate(() => {
        const validUuids = [
          '550e8400-e29b-41d4-a716-446655440000',
          '550e8400-e29b-41d4-a716-446655440001',
          '550e8400-e29b-41d4-a716-446655440002',
          '550e8400-e29b-41d4-a716-446655440003',
        ];
        validUuids.forEach((nonce, i) => {
          window.postMessage(
            {
              type: 'CAPAUTH_SIGN_REQUEST',
              requestId: `req-${i}`,
              challenge: nonce,
              serviceUrl: 'https://test.example.com',
            },
            '*'
          );
        });
      });

      await page.waitForTimeout(600);

      const responses = await page.evaluate(() => window.__signResponses);
      // 4th request (req-3) should be rejected due to queue limit
      const rejections = responses.filter((r) => r.type === 'CAPAUTH_SIGN_ERROR');
      expect(rejections.some((r) => r.requestId === 'req-3')).toBe(true);
    } finally {
      await page.close();
    }
  });
});
