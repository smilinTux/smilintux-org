/**
 * weblink-signaling/test/worker.test.ts
 *
 * Integration tests for the CF Durable Objects signaling relay.
 * Run with: npm test
 *
 * Covers:
 *   - Health endpoint
 *   - WebSocket upgrade (success + rejection)
 *   - Room creation and peer listing
 *   - Signal message routing between peers
 *   - Server-enforced sender identity (anti-spoofing)
 *   - Auth token rejection with WS close code 4401 (planned)
 *   - CORS preflight
 */

import { describe, it, expect } from "vitest";
import { SELF } from "cloudflare:test";

/** Base URL matching the wrangler route pattern used by Miniflare in tests. */
const BASE = "https://ws.weblink.skworld.io";

// ─────────────────────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────────────────────

describe("GET /health", () => {
  it("returns 200 with service ok payload", async () => {
    const res = await SELF.fetch(`${BASE}/health`);
    expect(res.status).toBe(200);

    const body = await res.json<{ service: string; status: string; ts: string }>();
    expect(body.service).toBe("weblink-signaling");
    expect(body.status).toBe("ok");
    expect(typeof body.ts).toBe("string");
  });

  it("includes CORS headers", async () => {
    const res = await SELF.fetch(`${BASE}/health`);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unknown routes
// ─────────────────────────────────────────────────────────────────────────────

describe("Unknown routes", () => {
  it("returns 404 for unmatched paths", async () => {
    const res = await SELF.fetch(`${BASE}/unknown-path`);
    expect(res.status).toBe(404);
  });

  it("returns 404 for GET /api/v1/webrtc/peers with wrong method (POST)", async () => {
    const res = await SELF.fetch(`${BASE}/api/v1/webrtc/peers?room=x`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CORS preflight
// ─────────────────────────────────────────────────────────────────────────────

describe("OPTIONS preflight", () => {
  it("returns 204 with CORS allow headers", async () => {
    const res = await SELF.fetch(`${BASE}/health`, { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeTruthy();
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket upgrade
// ─────────────────────────────────────────────────────────────────────────────

describe("WebSocket upgrade — rejection (non-WS HTTP requests)", () => {
  it("rejects plain HTTP on /ws with 426 Upgrade Required", async () => {
    const res = await SELF.fetch(`${BASE}/ws?room=r&peer=alice`);
    expect(res.status).toBe(426);
  });

  it("rejects plain HTTP on /webrtc/ws with 426 Upgrade Required", async () => {
    const res = await SELF.fetch(`${BASE}/webrtc/ws?room=r&peer=alice`);
    expect(res.status).toBe(426);
  });
});

describe("WebSocket upgrade — acceptance", () => {
  it("accepts upgrade on /ws and returns 101 with a WebSocket", async () => {
    const res = await SELF.fetch(`${BASE}/ws?room=upgrade-test-1&peer=alice`, {
      headers: { Upgrade: "websocket" },
    });
    expect(res.status).toBe(101);
    const ws = (res as unknown as { webSocket: WebSocket | null }).webSocket;
    expect(ws).not.toBeNull();
    ws?.close();
  });

  it("accepts upgrade on /webrtc/ws and returns 101 with a WebSocket", async () => {
    const res = await SELF.fetch(`${BASE}/webrtc/ws?room=upgrade-test-2&peer=bob`, {
      headers: { Upgrade: "websocket" },
    });
    expect(res.status).toBe(101);
    const ws = (res as unknown as { webSocket: WebSocket | null }).webSocket;
    expect(ws).not.toBeNull();
    ws?.close();
  });

  it("sends welcome message with current peer list on connect", async () => {
    const room = "welcome-test";
    const res = await SELF.fetch(`${BASE}/ws?room=${room}&peer=alice`, {
      headers: { Upgrade: "websocket" },
    });
    const ws = (res as unknown as { webSocket: WebSocket }).webSocket;
    ws.accept();

    const messages: unknown[] = [];
    await new Promise<void>((resolve) => {
      ws.addEventListener("message", (e) => {
        messages.push(JSON.parse((e as MessageEvent<string>).data));
        resolve();
      });
    });

    expect(messages).toHaveLength(1);
    const welcome = messages[0] as { type: string; peers: string[] };
    expect(welcome.type).toBe("welcome");
    expect(Array.isArray(welcome.peers)).toBe(true);
    ws.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Room creation and peer listing
// ─────────────────────────────────────────────────────────────────────────────

describe("Room peer listing — GET /api/v1/webrtc/peers", () => {
  it("returns empty peers array for a brand-new room", async () => {
    const res = await SELF.fetch(`${BASE}/api/v1/webrtc/peers?room=empty-room-xyz`);
    expect(res.status).toBe(200);

    const body = await res.json<{ room: string; peers: string[]; count: number }>();
    expect(body.room).toBe("empty-room-xyz");
    expect(body.peers).toEqual([]);
    expect(body.count).toBe(0);
  });

  it("uses 'default' room when ?room param is omitted", async () => {
    const res = await SELF.fetch(`${BASE}/api/v1/webrtc/peers`);
    expect(res.status).toBe(200);

    const body = await res.json<{ room: string }>();
    expect(body.room).toBe("default");
  });

  it("lists connected peer after WebSocket join", async () => {
    const room = "peer-list-test";

    // Connect alice to the room
    const wsRes = await SELF.fetch(`${BASE}/ws?room=${room}&peer=alice`, {
      headers: { Upgrade: "websocket" },
    });
    const ws = (wsRes as unknown as { webSocket: WebSocket }).webSocket;
    ws.accept();

    // Wait for the welcome message before querying peers
    await new Promise<void>((resolve) => {
      ws.addEventListener("message", () => resolve());
    });

    // Peer list should now include alice
    const peersRes = await SELF.fetch(`${BASE}/api/v1/webrtc/peers?room=${room}`);
    const body = await peersRes.json<{ peers: string[]; count: number }>();
    expect(body.peers).toContain("alice");
    expect(body.count).toBeGreaterThanOrEqual(1);

    ws.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Signal message routing
// ─────────────────────────────────────────────────────────────────────────────

describe("Signal message routing", () => {
  it("delivers signal from bob to alice with server-stamped 'from' field", async () => {
    const room = "routing-test";

    // Connect alice
    const aliceRes = await SELF.fetch(`${BASE}/ws?room=${room}&peer=alice`, {
      headers: { Upgrade: "websocket" },
    });
    const aliceWs = (aliceRes as unknown as { webSocket: WebSocket }).webSocket;
    aliceWs.accept();

    const aliceMessages: unknown[] = [];
    aliceWs.addEventListener("message", (e) => {
      aliceMessages.push(JSON.parse((e as MessageEvent<string>).data));
    });

    // Wait for alice's welcome
    await new Promise<void>((resolve) => {
      aliceWs.addEventListener("message", () => resolve(), { once: true });
    });

    // Connect bob
    const bobRes = await SELF.fetch(`${BASE}/ws?room=${room}&peer=bob`, {
      headers: { Upgrade: "websocket" },
    });
    const bobWs = (bobRes as unknown as { webSocket: WebSocket }).webSocket;
    bobWs.accept();

    const bobMessages: unknown[] = [];
    bobWs.addEventListener("message", (e) => {
      bobMessages.push(JSON.parse((e as MessageEvent<string>).data));
    });

    // Wait for bob's welcome
    await new Promise<void>((resolve) => {
      bobWs.addEventListener("message", () => resolve(), { once: true });
    });

    // Bob sends a signal to alice
    bobWs.send(JSON.stringify({ type: "signal", to: "alice", data: { sdp: "offer-v1" } }));

    // Wait for alice to receive the signal
    await new Promise<void>((resolve) => {
      const check = () => {
        if (aliceMessages.some((m: any) => m.type === "signal")) {
          resolve();
        } else {
          setTimeout(check, 10);
        }
      };
      setTimeout(check, 10);
    });

    const signal = aliceMessages.find((m: any) => m.type === "signal") as any;
    expect(signal).toBeDefined();
    // Server stamps the authenticated peer id as 'from', not a client-supplied value
    expect(signal.from).toBe("bob");
    expect(signal.data).toEqual({ sdp: "offer-v1" });

    aliceWs.close();
    bobWs.close();
  });

  it("notifies existing peers when a new peer joins", async () => {
    const room = "join-notify-test";

    // Connect alice first
    const aliceRes = await SELF.fetch(`${BASE}/ws?room=${room}&peer=alice`, {
      headers: { Upgrade: "websocket" },
    });
    const aliceWs = (aliceRes as unknown as { webSocket: WebSocket }).webSocket;
    aliceWs.accept();

    const aliceMessages: unknown[] = [];
    aliceWs.addEventListener("message", (e) => {
      aliceMessages.push(JSON.parse((e as MessageEvent<string>).data));
    });

    // Wait for alice's welcome
    await new Promise<void>((resolve) => {
      aliceWs.addEventListener("message", () => resolve(), { once: true });
    });

    // Connect bob — alice should receive peer_joined
    const bobRes = await SELF.fetch(`${BASE}/ws?room=${room}&peer=bob`, {
      headers: { Upgrade: "websocket" },
    });
    const bobWs = (bobRes as unknown as { webSocket: WebSocket }).webSocket;
    bobWs.accept();

    // Wait for alice to get the peer_joined notification
    await new Promise<void>((resolve) => {
      const check = () => {
        if (aliceMessages.some((m: any) => m.type === "peer_joined")) {
          resolve();
        } else {
          setTimeout(check, 10);
        }
      };
      setTimeout(check, 10);
    });

    const joined = aliceMessages.find((m: any) => m.type === "peer_joined") as any;
    expect(joined).toBeDefined();
    expect(joined.peer).toBe("bob");

    aliceWs.close();
    bobWs.close();
  });

  it("server ignores client-forged 'from' field in signal payloads", async () => {
    const room = "anti-spoof-test";

    // Connect alice
    const aliceRes = await SELF.fetch(`${BASE}/ws?room=${room}&peer=alice`, {
      headers: { Upgrade: "websocket" },
    });
    const aliceWs = (aliceRes as unknown as { webSocket: WebSocket }).webSocket;
    aliceWs.accept();
    const aliceMessages: unknown[] = [];
    aliceWs.addEventListener("message", (e) => {
      aliceMessages.push(JSON.parse((e as MessageEvent<string>).data));
    });
    await new Promise<void>((r) => {
      aliceWs.addEventListener("message", () => r(), { once: true });
    });

    // Connect eve — she will try to impersonate alice
    const eveRes = await SELF.fetch(`${BASE}/ws?room=${room}&peer=eve`, {
      headers: { Upgrade: "websocket" },
    });
    const eveWs = (eveRes as unknown as { webSocket: WebSocket }).webSocket;
    eveWs.accept();
    await new Promise<void>((r) => {
      eveWs.addEventListener("message", () => r(), { once: true });
    });

    // Eve tries to forge from="alice" in the message body — server ignores it
    eveWs.send(JSON.stringify({ type: "signal", from: "alice", to: "alice", data: { spoofed: true } }));

    await new Promise<void>((resolve) => {
      const check = () => {
        if (aliceMessages.some((m: any) => m.type === "signal")) resolve();
        else setTimeout(check, 10);
      };
      setTimeout(check, 10);
    });

    const signal = aliceMessages.find((m: any) => m.type === "signal") as any;
    // Server stamps from=eve (the authenticated peer id from the WS tag), not "alice"
    expect(signal.from).toBe("eve");

    aliceWs.close();
    eveWs.close();
  });

  it("silently drops signal to a non-existent peer", async () => {
    const room = "drop-test";
    const wsRes = await SELF.fetch(`${BASE}/ws?room=${room}&peer=alice`, {
      headers: { Upgrade: "websocket" },
    });
    const ws = (wsRes as unknown as { webSocket: WebSocket }).webSocket;
    ws.accept();
    await new Promise<void>((r) => {
      ws.addEventListener("message", () => r(), { once: true });
    });

    // Send to a peer that doesn't exist — should not throw or error
    expect(() => {
      ws.send(JSON.stringify({ type: "signal", to: "ghost", data: { sdp: "x" } }));
    }).not.toThrow();

    ws.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Auth token rejection (planned — CapAuth integration)
// ─────────────────────────────────────────────────────────────────────────────

describe("Auth token rejection", () => {
  // CapAuth validation is designed to close the WebSocket with code 4401
  // when the bearer token is absent or invalid. These tests document the
  // planned behavior and will pass once the feature is implemented.
  it.todo(
    "closes WebSocket with code 4401 when Authorization header is absent on protected rooms"
  );
  it.todo(
    "closes WebSocket with code 4401 when Authorization bearer token fails CapAuth PGP validation"
  );
  it.todo(
    "accepts upgrade and sets authenticated peer id from CapAuth fingerprint when token is valid"
  );
});
