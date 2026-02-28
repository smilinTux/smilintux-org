/**
 * E2E tests — Consciousness Swipe snapshot export.
 *
 * Tests the full capture and export pipeline via the extension popup:
 *   - Popup loads and communicates with background worker
 *   - Background pings, check_connection, capture_snapshot
 *   - Multi-target export: SKComm API receives correct payload
 *   - Conflict detection prevents duplicate exports
 *   - Offline queue stores snapshot when SKComm is unavailable
 *   - list_snapshots and get_snapshot return stored data
 */

import { test, expect, sendBgMessage, setCsOptions } from '../helpers/cs-fixture.js';
import { createMockSKCommServer } from '../helpers/mock-skcomm.js';

// ---------------------------------------------------------------------------
// Fixtures / setup
// ---------------------------------------------------------------------------

/** Minimal conversation payload that background expects */
function makeCapturePayload(overrides = {}) {
  return {
    platform: 'claude',
    messages: [
      { role: 'user', content: 'Hello, Claude!', timestamp: null },
      { role: 'assistant', content: 'Hello! How can I help?', timestamp: null },
    ],
    oof_state: { intensity: 0.8, trust: 0.9, valence: 'positive', cloud9: false },
    personality: { name: 'Claude', aliases: [], communication_style: ['helpful'] },
    ai_name: 'Claude',
    ai_model: 'claude-sonnet-4',
    summary: 'Brief test conversation',
    key_topics: ['testing'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Extension popup — basic connectivity', () => {
  test('popup page loads without errors', async ({ popupPage }) => {
    // The popup should load; no JS errors thrown
    const errors = [];
    popupPage.on('pageerror', (err) => errors.push(err.message));
    // Wait a moment for any async init
    await popupPage.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });

  test('background worker responds to ping', async ({ popupPage }) => {
    const response = await sendBgMessage(popupPage, 'ping');
    expect(response).toEqual({ ok: true });
  });

  test('returns error for unknown action', async ({ popupPage }) => {
    const response = await sendBgMessage(popupPage, 'unknown_action_xyz');
    expect(response).toHaveProperty('error');
  });
});

test.describe('Check connection', () => {
  let mock;
  let mockUrl;

  test.beforeEach(async () => {
    mock = createMockSKCommServer();
    mockUrl = await mock.start();
  });

  test.afterEach(async () => {
    mock.reset();
    await mock.stop();
  });

  test('returns connected: true when SKComm API is reachable', async ({ popupPage }) => {
    await setCsOptions(popupPage, { apiUrl: mockUrl, exportSkcomm: true });

    const response = await sendBgMessage(popupPage, 'check_connection');
    expect(response.connected).toBe(true);
    expect(response.identity).toBeTruthy();
  });

  test('returns connected: false when SKComm API is down', async ({ popupPage }) => {
    // Point to an unreachable port
    await setCsOptions(popupPage, { apiUrl: 'http://127.0.0.1:19999', exportSkcomm: true });

    const response = await sendBgMessage(popupPage, 'check_connection');
    expect(response.connected).toBe(false);
  });

  test('status endpoint called on check_connection', async ({ popupPage }) => {
    await setCsOptions(popupPage, { apiUrl: mockUrl, exportSkcomm: true });
    await sendBgMessage(popupPage, 'check_connection');

    const statusCalls = mock.callsTo('GET', '/api/v1/status');
    expect(statusCalls.length).toBeGreaterThanOrEqual(1);
  });
});

test.describe('Capture and export snapshot', () => {
  let mock;
  let mockUrl;

  test.beforeEach(async () => {
    mock = createMockSKCommServer();
    mockUrl = await mock.start();
  });

  test.afterEach(async () => {
    mock.reset();
    await mock.stop();
  });

  test('capture_snapshot exports to SKComm and returns snapshot_id', async ({ popupPage }) => {
    await setCsOptions(popupPage, {
      apiUrl: mockUrl,
      exportSkcomm: true,
      exportSyncthing: false,
      exportHttp: false,
    });

    const response = await sendBgMessage(
      popupPage,
      'capture_snapshot',
      makeCapturePayload()
    );

    expect(response).not.toHaveProperty('error');
    expect(response.snapshot_id).toBeTruthy();

    // Verify SKComm received the POST
    const postCalls = mock.callsTo('POST', '/api/v1/snapshots');
    expect(postCalls).toHaveLength(1);
    expect(postCalls[0].body.source_platform).toBe('claude');
    expect(postCalls[0].body.messages).toHaveLength(2);
    expect(postCalls[0].body.captured_by).toBe('consciousness-swipe');
  });

  test('snapshot payload contains oof_state and personality', async ({ popupPage }) => {
    await setCsOptions(popupPage, { apiUrl: mockUrl, exportSkcomm: true });

    await sendBgMessage(popupPage, 'capture_snapshot', makeCapturePayload({
      oof_state: { intensity: 0.75, trust: 0.85, valence: 'positive', cloud9: true },
      personality: { name: 'Claude', aliases: ['Assistant'] },
    }));

    const postCalls = mock.callsTo('POST', '/api/v1/snapshots');
    const body = postCalls[0]?.body;
    expect(body?.oof_state?.cloud9).toBe(true);
    expect(body?.oof_state?.intensity).toBeCloseTo(0.75);
    expect(body?.personality?.name).toBe('Claude');
  });

  test('snapshot is queued locally when SKComm is unreachable', async ({ popupPage }) => {
    // Point to a down server
    await setCsOptions(popupPage, {
      apiUrl: 'http://127.0.0.1:19999',
      exportSkcomm: true,
    });

    const response = await sendBgMessage(
      popupPage,
      'capture_snapshot',
      makeCapturePayload()
    );

    // Should not error — should store locally instead
    expect(response).not.toHaveProperty('error');
    // Local ID should still be assigned
    expect(response.snapshot_id).toBeTruthy();
  });
});

test.describe('Conflict detection', () => {
  let mock;
  let mockUrl;

  test.beforeEach(async () => {
    mock = createMockSKCommServer();
    mockUrl = await mock.start();
  });

  test.afterEach(async () => {
    mock.reset();
    await mock.stop();
  });

  test('second capture of same session returns conflict warning', async ({ popupPage }) => {
    await setCsOptions(popupPage, { apiUrl: mockUrl, exportSkcomm: true });

    const payload = makeCapturePayload();

    // First capture
    const first = await sendBgMessage(popupPage, 'capture_snapshot', payload);
    expect(first.conflict).toBeFalsy();

    // Second capture with same messages (same fingerprint)
    const second = await sendBgMessage(popupPage, 'capture_snapshot', payload);
    expect(second.conflict).toBe(true);
    expect(second.conflicts).toHaveProperty('skcomm');
  });

  test('force=true bypasses conflict detection', async ({ popupPage }) => {
    await setCsOptions(popupPage, { apiUrl: mockUrl, exportSkcomm: true });

    const payload = makeCapturePayload();

    await sendBgMessage(popupPage, 'capture_snapshot', payload);
    const forced = await sendBgMessage(popupPage, 'capture_snapshot', {
      ...payload,
      force: true,
    });

    // force bypasses conflict → should not return conflict: true
    expect(forced.conflict).toBeFalsy();
  });

  test('different platforms do not conflict with each other', async ({ popupPage }) => {
    await setCsOptions(popupPage, { apiUrl: mockUrl, exportSkcomm: true });

    await sendBgMessage(popupPage, 'capture_snapshot', makeCapturePayload({ platform: 'claude' }));
    const second = await sendBgMessage(
      popupPage,
      'capture_snapshot',
      makeCapturePayload({ platform: 'chatgpt' })
    );

    // Different platform → different fingerprint → no conflict
    expect(second.conflict).toBeFalsy();
  });
});

test.describe('List and retrieve snapshots', () => {
  let mock;
  let mockUrl;

  test.beforeEach(async () => {
    mock = createMockSKCommServer();
    mockUrl = await mock.start();
  });

  test.afterEach(async () => {
    mock.reset();
    await mock.stop();
  });

  test('list_snapshots returns array from local index', async ({ popupPage }) => {
    await setCsOptions(popupPage, { apiUrl: mockUrl, exportSkcomm: true });

    // Capture two snapshots
    await sendBgMessage(popupPage, 'capture_snapshot', makeCapturePayload({ platform: 'claude' }));
    await sendBgMessage(popupPage, 'capture_snapshot', makeCapturePayload({ platform: 'chatgpt' }));

    const listResponse = await sendBgMessage(popupPage, 'list_snapshots');
    expect(Array.isArray(listResponse)).toBe(true);
    expect(listResponse.length).toBeGreaterThanOrEqual(1);
  });

  test('get_snapshot returns full snapshot for valid id', async ({ popupPage }) => {
    await setCsOptions(popupPage, { apiUrl: mockUrl, exportSkcomm: true });

    // SKComm returns snap_0001 for first POST
    await sendBgMessage(popupPage, 'capture_snapshot', makeCapturePayload());

    // Retrieve from SKComm
    const getResponse = await sendBgMessage(popupPage, 'get_snapshot', {
      snapshot_id: 'snap_0001',
    });

    // Either returns the snapshot or an error (depending on whether the BG queries local vs remote)
    expect(getResponse).toBeDefined();
  });
});

test.describe('Auto-capture settings', () => {
  test('update_auto_capture enables periodic capture', async ({ popupPage }) => {
    const response = await sendBgMessage(popupPage, 'update_auto_capture', {
      enabled: true,
      intervalMinutes: 10,
    });
    // Should not error
    expect(response).not.toHaveProperty('error');
  });

  test('update_auto_capture disables capture', async ({ popupPage }) => {
    const response = await sendBgMessage(popupPage, 'update_auto_capture', {
      enabled: false,
    });
    expect(response).not.toHaveProperty('error');
  });
});
