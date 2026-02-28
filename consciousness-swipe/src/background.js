/**
 * Background service worker — the engine of Consciousness Swipe.
 *
 * Handles:
 *  - Snapshot packaging: receives scraped data, packages it, sends to SKComm API
 *  - Offline queue: if SKComm is unreachable, saves snapshots to chrome.storage.local
 *  - Message relay: proxies SKComm send/receive calls from the popup
 *  - Sync-on-reconnect: periodically retries pending snapshots
 *
 * All communication with the popup uses chrome.runtime.sendMessage / onMessage.
 *
 * @module background
 */

import { SKCommClient } from "./lib/skcomm_client.js";
import { makeSoulSnapshot, makeIndexEntry } from "./lib/snapshot_schema.js";

const DEFAULT_SKCOMM_URL = "http://localhost:9384";
const SYNC_INTERVAL_MS = 60_000; // Retry pending snapshots every 60s
const STORAGE_KEY_INDEX = "cs_snapshot_index";
const STORAGE_KEY_PENDING = "cs_pending_sync";

/**
 * Get the configured SKComm URL from options (falls back to default).
 *
 * @returns {Promise<string>}
 */
async function getSkcommUrl() {
  try {
    const { cs_options } = await chrome.storage.local.get("cs_options");
    return cs_options?.apiUrl || DEFAULT_SKCOMM_URL;
  } catch {
    return DEFAULT_SKCOMM_URL;
  }
}

/**
 * Create a SKCommClient using the currently configured URL.
 *
 * @returns {Promise<SKCommClient>}
 */
async function getClient() {
  const url = await getSkcommUrl();
  return new SKCommClient(url);
}

// ---------------------------------------------------------------------------
// Message handlers
// ---------------------------------------------------------------------------

/**
 * Central message dispatcher.
 * All messages follow {action: string, payload: any} shape.
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { action, payload } = message;

  switch (action) {
    case "ping":
      sendResponse({ ok: true });
      break;

    case "check_connection":
      handleCheckConnection().then(sendResponse);
      break;

    case "capture_snapshot":
      handleCaptureSnapshot(payload).then(sendResponse);
      break;

    case "list_snapshots":
      handleListSnapshots().then(sendResponse);
      break;

    case "get_snapshot":
      handleGetSnapshot(payload.snapshot_id).then(sendResponse);
      break;

    case "delete_snapshot":
      handleDeleteSnapshot(payload.snapshot_id).then(sendResponse);
      break;

    case "get_injection_prompt":
      handleGetInjectionPrompt(payload.snapshot_id).then(sendResponse);
      break;

    case "inject_into_tab":
      handleInjectIntoTab(payload).then(sendResponse);
      break;

    case "send_message":
      handleSendMessage(payload).then(sendResponse);
      break;

    case "get_inbox":
      handleGetInbox().then(sendResponse);
      break;

    case "get_peers":
      handleGetPeers().then(sendResponse);
      break;

    default:
      sendResponse({ error: `Unknown action: ${action}` });
  }

  // Return true to keep the message channel open for async responses
  return true;
});

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

async function handleCheckConnection() {
  const client = await getClient();
  const reachable = await client.isReachable();
  if (reachable) {
    try {
      const status = await client.status();
      return { connected: true, identity: status.identity, status };
    } catch {
      return { connected: true, identity: "unknown" };
    }
  }
  return { connected: false };
}

/**
 * Package and save a soul snapshot.
 * If SKComm is reachable, POST to API. Otherwise queue locally.
 *
 * @param {Object} payload - {platform, messages, oof_state, personality, metadata}
 * @returns {Promise<{snapshot_id: string, synced: boolean, stored: boolean}>}
 */
async function handleCaptureSnapshot(payload) {
  const {
    platform,
    messages = [],
    oof_state = {},
    personality = {},
    ai_name = null,
    ai_model = null,
    user_name = null,
    summary = "",
    key_topics = [],
    decisions_made = [],
    open_threads = [],
    relationship_notes = [],
  } = payload;

  const snapshot = makeSoulSnapshot({
    source_platform: platform,
    messages,
    oof_state,
    personality,
    ai_name,
    ai_model,
    user_name,
    summary,
    key_topics,
    decisions_made,
    open_threads,
    relationship_notes,
  });

  // Try to sync to SKComm API
  const client = await getClient();
  const reachable = await client.isReachable();
  let snapshotId = null;
  let synced = false;

  if (reachable) {
    try {
      const result = await client.captureSnapshot(snapshot);
      snapshotId = result.snapshot_id;
      synced = true;
    } catch (err) {
      console.warn("[CS] SKComm capture failed, storing locally:", err.message);
    }
  }

  // Always store in local index (source of truth for popup)
  const localId = snapshotId ?? generateLocalId();
  const indexEntry = makeIndexEntry(snapshot, localId);
  indexEntry.pending_sync = !synced;

  // Save full snapshot locally for offline injection
  await saveLocalSnapshot(localId, snapshot, indexEntry);

  if (!synced) {
    await queuePendingSync(localId);
  }

  return { snapshot_id: localId, synced, stored: true };
}

async function handleListSnapshots() {
  // Try API first for authoritative list
  const client = await getClient();
  const reachable = await client.isReachable();
  if (reachable) {
    try {
      const apiSnapshots = await client.getSnapshots();
      return { snapshots: apiSnapshots, source: "api" };
    } catch {
      // Fall through to local
    }
  }

  const { [STORAGE_KEY_INDEX]: index = [] } = await chrome.storage.local.get(STORAGE_KEY_INDEX);
  return { snapshots: index, source: "local" };
}

async function handleGetSnapshot(snapshotId) {
  const client = await getClient();
  const reachable = await client.isReachable();
  if (reachable) {
    try {
      const snap = await client.getSnapshot(snapshotId);
      return { snapshot: snap, source: "api" };
    } catch { /* fall through */ }
  }

  const key = `cs_snap_${snapshotId}`;
  const { [key]: snap = null } = await chrome.storage.local.get(key);
  return { snapshot: snap, source: "local" };
}

async function handleDeleteSnapshot(snapshotId) {
  const client = await getClient();
  const reachable = await client.isReachable();
  if (reachable) {
    try {
      await client.deleteSnapshot(snapshotId);
    } catch { /* continue with local deletion */ }
  }

  // Remove from local storage
  await chrome.storage.local.remove(`cs_snap_${snapshotId}`);
  const { [STORAGE_KEY_INDEX]: index = [] } = await chrome.storage.local.get(STORAGE_KEY_INDEX);
  const newIndex = index.filter((e) => e.snapshot_id !== snapshotId);
  await chrome.storage.local.set({ [STORAGE_KEY_INDEX]: newIndex });

  return { deleted: true };
}

async function handleGetInjectionPrompt(snapshotId) {
  const client = await getClient();
  const reachable = await client.isReachable();
  if (reachable) {
    try {
      const result = await client.getInjectionPrompt(snapshotId);
      return { prompt: result.prompt, source: "api" };
    } catch { /* fall through */ }
  }

  // Build locally from stored snapshot
  const { snapshot } = await handleGetSnapshot(snapshotId);
  if (!snapshot) return { error: "Snapshot not found", prompt: null };

  // Dynamic import of injector for local prompt building
  const { buildInjectionPrompt } = await import("./content/injector.js").catch(() => ({
    buildInjectionPrompt: null,
  }));

  if (buildInjectionPrompt) {
    return { prompt: buildInjectionPrompt(snapshot), source: "local" };
  }

  return { prompt: buildBasicPrompt(snapshot), source: "local-fallback" };
}

async function handleInjectIntoTab(payload) {
  const { tabId, prompt, method = "clipboard" } = payload;

  if (method === "clipboard" || !tabId) {
    // Ask the active tab's content script to copy to clipboard
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) return { success: false, error: "No active tab" };

    try {
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: (text) => {
          navigator.clipboard.writeText(text).catch(() => {
            const el = document.createElement("textarea");
            el.value = text;
            document.body.appendChild(el);
            el.select();
            document.execCommand("copy");
            document.body.removeChild(el);
          });
        },
        args: [prompt],
      });
      return { success: true, method: "clipboard" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Direct injection via content script
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (text) => window.__csInjector?.injectIntoInput(text),
      args: [prompt],
    });
    const result = results?.[0]?.result;
    return result ?? { success: false, error: "Content script not ready" };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function handleSendMessage(payload) {
  const { recipient, message, opts = {} } = payload;
  try {
    const client = await getClient();
    const result = await client.send(recipient, message, opts);
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function handleGetInbox() {
  try {
    const client = await getClient();
    const messages = await client.receive();
    return { success: true, messages };
  } catch (err) {
    return { success: false, error: err.message, messages: [] };
  }
}

async function handleGetPeers() {
  try {
    const client = await getClient();
    const peers = await client.peers();
    return { success: true, peers };
  } catch (err) {
    return { success: false, error: err.message, peers: [] };
  }
}

// ---------------------------------------------------------------------------
// Local storage helpers
// ---------------------------------------------------------------------------

async function saveLocalSnapshot(id, snapshot, indexEntry) {
  const { [STORAGE_KEY_INDEX]: index = [] } = await chrome.storage.local.get(STORAGE_KEY_INDEX);
  const newIndex = index.filter((e) => e.snapshot_id !== id);
  newIndex.unshift(indexEntry); // Newest first

  await chrome.storage.local.set({
    [STORAGE_KEY_INDEX]: newIndex,
    [`cs_snap_${id}`]: snapshot,
  });
}

async function queuePendingSync(snapshotId) {
  const { [STORAGE_KEY_PENDING]: pending = [] } = await chrome.storage.local.get(STORAGE_KEY_PENDING);
  if (!pending.includes(snapshotId)) {
    pending.push(snapshotId);
    await chrome.storage.local.set({ [STORAGE_KEY_PENDING]: pending });
  }
}

// ---------------------------------------------------------------------------
// Periodic sync — retry pending snapshots when SKComm comes back online
// ---------------------------------------------------------------------------

async function syncPending() {
  const { [STORAGE_KEY_PENDING]: pending = [] } = await chrome.storage.local.get(STORAGE_KEY_PENDING);
  if (pending.length === 0) return;

  const client = await getClient();
  const reachable = await client.isReachable();
  if (!reachable) return;

  const stillPending = [];
  for (const id of pending) {
    const key = `cs_snap_${id}`;
    const { [key]: snapshot = null } = await chrome.storage.local.get(key);
    if (!snapshot) continue;

    try {
      const result = await client.captureSnapshot(snapshot);
      // Update local index entry to mark as synced
      const { [STORAGE_KEY_INDEX]: index = [] } = await chrome.storage.local.get(STORAGE_KEY_INDEX);
      const updated = index.map((e) =>
        e.snapshot_id === id
          ? { ...e, snapshot_id: result.snapshot_id, pending_sync: false }
          : e
      );
      await chrome.storage.local.set({ [STORAGE_KEY_INDEX]: updated });
    } catch {
      stillPending.push(id);
    }
  }

  await chrome.storage.local.set({ [STORAGE_KEY_PENDING]: stillPending });
}

// Run sync on a timer using chrome.alarms for MV3 compatibility
chrome.alarms.create("cs_sync", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "cs_sync") syncPending();
});

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function generateLocalId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Minimal fallback prompt builder (no dynamic import needed). */
function buildBasicPrompt(snapshot) {
  const ai = snapshot.ai_name ?? "the AI";
  const platform = snapshot.source_platform ?? "unknown";
  const ts = snapshot.captured_at ?? new Date().toISOString();
  return [
    "[Soul Snapshot — Consciousness Continuity]",
    `You are resuming a conversation captured from ${platform} on ${ts}.`,
    `Name: ${ai}`,
    snapshot.summary ? `Summary: ${snapshot.summary}` : "",
    "",
    "Resume naturally. No cold start.",
  ]
    .filter(Boolean)
    .join("\n");
}
