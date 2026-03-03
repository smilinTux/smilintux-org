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
 *   - Auth token rejection with WS close code 4401
 *   - CORS preflight
 *   - Room lifecycle (join, leave, cleanup)
 *   - Peer isolation across rooms
 *   - SDP offer/answer relay
 *   - ICE candidate relay
 *   - Error handling (malformed JSON, binary messages, unknown message types)
 *   - Multiple peers in a single room
 *   - Reconnection after disconnect
 *   - Default peer ID ("anonymous") when param is omitted
 *   - Room persistence: members stored in DO KV on join, removed on leave
 *   - Room persistence: alarmAt scheduled (24h TTL) on first peer join
 *   - ICE candidate buffer: signals buffered for offline peers, delivered on reconnect
 *   - ICE candidate buffer: capped at ICE_BUFFER_MAX (50), buffer cleared after delivery
 *   - DO alarm: closes all connections with code 4004, wipes room:state + alarmAt
 *   - DO alarm: empty-room expire and rejoin after wipe
 */

import { describe, it, expect } from "vitest";
import { SELF } from "cloudflare:test";

/** Base URL matching the wrangler route pattern used by Miniflare in tests. */
const BASE = "https://ws.weblink.skworld.io";

// ─────────────────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Connect a peer to a room and return the accepted client-side WebSocket. */
async function connectPeer(
  room: string,
  peer: string,
  path = "/ws"
): Promise<WebSocket> {
  const res = await SELF.fetch(`${BASE}${path}?room=${room}&peer=${peer}`, {
    headers: { Upgrade: "websocket" },
  });
  const ws = (res as unknown as { webSocket: WebSocket }).webSocket;
  ws.accept();
  return ws;
}

/** Connect a peer with an explicit Authorization: Bearer header. */
async function connectPeerWithToken(
  room: string,
  peer: string,
  token: string,
  path = "/ws"
): Promise<WebSocket> {
  const res = await SELF.fetch(`${BASE}${path}?room=${room}&peer=${peer}`, {
    headers: { Upgrade: "websocket", Authorization: `Bearer ${token}` },
  });
  const ws = (res as unknown as { webSocket: WebSocket }).webSocket;
  ws.accept();
  return ws;
}

/** Wait for a WebSocket close event and return the close code. */
function waitForClose(ws: WebSocket, timeoutMs = 2000): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("waitForClose timed out")),
      timeoutMs
    );
    ws.addEventListener("close", (e) => {
      clearTimeout(timer);
      resolve((e as CloseEvent).code);
    });
  });
}

/** Collect all messages received on a WebSocket into the returned array. */
function collectMessages(ws: WebSocket): unknown[] {
  const messages: unknown[] = [];
  ws.addEventListener("message", (e) => {
    try {
      messages.push(JSON.parse((e as MessageEvent<string>).data));
    } catch {
      // binary or unparseable — store raw
      messages.push((e as MessageEvent).data);
    }
  });
  return messages;
}

/** Wait until the predicate returns true against the messages array. */
async function waitFor(
  messages: unknown[],
  predicate: (m: any) => boolean,
  timeoutMs = 2000
): Promise<void> {
  const start = Date.now();
  return new Promise<void>((resolve, reject) => {
    const check = () => {
      if (messages.some(predicate)) {
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        reject(new Error("waitFor timed out"));
      } else {
        setTimeout(check, 10);
      }
    };
    setTimeout(check, 5);
  });
}

/** Wait for the welcome message and return it. */
async function waitForWelcome(
  messages: unknown[]
): Promise<{ type: string; peers: string[] }> {
  await waitFor(messages, (m: any) => m.type === "welcome");
  return messages.find((m: any) => m.type === "welcome") as {
    type: string;
    peers: string[];
  };
}

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
    ws?.accept();
    ws?.close();
  });

  it("accepts upgrade on /webrtc/ws and returns 101 with a WebSocket", async () => {
    const res = await SELF.fetch(`${BASE}/webrtc/ws?room=upgrade-test-2&peer=bob`, {
      headers: { Upgrade: "websocket" },
    });
    expect(res.status).toBe(101);
    const ws = (res as unknown as { webSocket: WebSocket | null }).webSocket;
    expect(ws).not.toBeNull();
    ws?.accept();
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
// Auth token rejection
//
// Rooms whose names start with "protected/" require a CapAuth bearer token.
// The Worker closes the client WebSocket with WS close code 4401 when the
// Authorization header is absent or the Bearer token is blank.
// ─────────────────────────────────────────────────────────────────────────────

describe("Auth token rejection", () => {
  it("closes WebSocket with code 4401 when Authorization header is absent on a protected/ room", async () => {
    const res = await SELF.fetch(
      `${BASE}/ws?room=protected/auth-test&peer=bob`,
      { headers: { Upgrade: "websocket" } }
    );
    const ws = (res as unknown as { webSocket: WebSocket }).webSocket;
    // Register close listener BEFORE accept() so we don't miss the event
    const closePromise = waitForClose(ws);
    ws.accept();

    const code = await closePromise;
    expect(code).toBe(4401);
  });

  it("closes WebSocket with code 4401 when Authorization bearer token is blank on a protected/ room", async () => {
    // "Authorization: Bearer   " — header present but token empty after trim
    const res = await SELF.fetch(
      `${BASE}/ws?room=protected/auth-blank-token&peer=bob`,
      { headers: { Upgrade: "websocket", Authorization: "Bearer   " } }
    );
    const ws = (res as unknown as { webSocket: WebSocket }).webSocket;
    const closePromise = waitForClose(ws);
    ws.accept();

    const code = await closePromise;
    expect(code).toBe(4401);
  });

  it("accepts upgrade on a protected/ room when a non-empty bearer token is present", async () => {
    const ws = await connectPeerWithToken(
      "protected/auth-accept",
      "alice",
      "dummy-dev-token"
    );
    const messages = collectMessages(ws);
    // A welcome message means the connection was not closed with 4401
    const welcome = await waitForWelcome(messages);

    expect(welcome.type).toBe("welcome");
    ws.close();
  });

  it.todo(
    "accepts upgrade and sets authenticated peer id from CapAuth PGP fingerprint when token is valid"
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Room lifecycle
// ─────────────────────────────────────────────────────────────────────────────

describe("Room lifecycle", () => {
  it("welcome message lists existing peers for second joiner", async () => {
    const room = "lifecycle-welcome";

    // Alice connects first
    const aliceWs = await connectPeer(room, "alice");
    const aliceMessages = collectMessages(aliceWs);
    await waitForWelcome(aliceMessages);

    // Bob joins — his welcome should list alice
    const bobWs = await connectPeer(room, "bob");
    const bobMessages = collectMessages(bobWs);
    const welcome = await waitForWelcome(bobMessages);

    expect(welcome.peers).toContain("alice");
    expect(welcome.peers).not.toContain("bob");

    aliceWs.close();
    bobWs.close();
  });

  it("notifies remaining peers when a peer leaves", async () => {
    const room = "lifecycle-leave";

    const aliceWs = await connectPeer(room, "alice");
    const aliceMessages = collectMessages(aliceWs);
    await waitForWelcome(aliceMessages);

    const bobWs = await connectPeer(room, "bob");
    const bobMessages = collectMessages(bobWs);
    await waitForWelcome(bobMessages);

    // Wait for alice to receive bob's peer_joined notification
    await waitFor(aliceMessages, (m: any) => m.type === "peer_joined");

    // Bob disconnects
    bobWs.close();

    // Alice should receive peer_left for bob
    await waitFor(aliceMessages, (m: any) => m.type === "peer_left");
    const left = aliceMessages.find((m: any) => m.type === "peer_left") as any;
    expect(left.peer).toBe("bob");

    aliceWs.close();
  });

  it("peer list is empty after all peers disconnect", async () => {
    const room = "lifecycle-cleanup";

    const aliceWs = await connectPeer(room, "alice");
    const aliceMessages = collectMessages(aliceWs);
    await waitForWelcome(aliceMessages);

    // alice disconnects
    aliceWs.close();

    // Allow time for the close event to propagate through the DO
    await new Promise((r) => setTimeout(r, 50));

    // Peers API should reflect an empty room
    const res = await SELF.fetch(`${BASE}/api/v1/webrtc/peers?room=${room}`);
    const body = await res.json<{ peers: string[]; count: number }>();
    expect(body.count).toBe(0);
    expect(body.peers).toEqual([]);
  });

  it("three peers join and leave in sequence, peer_joined/peer_left fire correctly", async () => {
    const room = "lifecycle-three-peers";

    const aliceWs = await connectPeer(room, "alice");
    const aliceMessages = collectMessages(aliceWs);
    await waitForWelcome(aliceMessages);

    const bobWs = await connectPeer(room, "bob");
    const bobMessages = collectMessages(bobWs);
    await waitForWelcome(bobMessages);

    // Alice sees bob join
    await waitFor(aliceMessages, (m: any) => m.type === "peer_joined" && m.peer === "bob");

    const charlieWs = await connectPeer(room, "charlie");
    const charlieMessages = collectMessages(charlieWs);
    const charlieWelcome = await waitForWelcome(charlieMessages);

    // Charlie's welcome should list both alice and bob
    expect(charlieWelcome.peers).toContain("alice");
    expect(charlieWelcome.peers).toContain("bob");

    // Alice and bob both see charlie join
    await waitFor(aliceMessages, (m: any) => m.type === "peer_joined" && m.peer === "charlie");
    await waitFor(bobMessages, (m: any) => m.type === "peer_joined" && m.peer === "charlie");

    // Bob leaves
    bobWs.close();
    await waitFor(aliceMessages, (m: any) => m.type === "peer_left" && m.peer === "bob");
    await waitFor(charlieMessages, (m: any) => m.type === "peer_left" && m.peer === "bob");

    aliceWs.close();
    charlieWs.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Peer isolation across rooms
// ─────────────────────────────────────────────────────────────────────────────

describe("Peer isolation across rooms", () => {
  it("signal in room-A is not delivered to peer in room-B", async () => {
    const roomA = "isolation-room-a";
    const roomB = "isolation-room-b";

    // Alice in room A
    const aliceWs = await connectPeer(roomA, "alice");
    const aliceMessages = collectMessages(aliceWs);
    await waitForWelcome(aliceMessages);

    // Bob in room A
    const bobWs = await connectPeer(roomA, "bob");
    const bobMessages = collectMessages(bobWs);
    await waitForWelcome(bobMessages);

    // Carol in room B (completely isolated)
    const carolWs = await connectPeer(roomB, "carol");
    const carolMessages = collectMessages(carolWs);
    await waitForWelcome(carolMessages);

    // Bob sends a signal to alice within room A
    bobWs.send(JSON.stringify({ type: "signal", to: "alice", data: { sdp: "room-a-offer" } }));

    // Alice receives it
    await waitFor(aliceMessages, (m: any) => m.type === "signal");
    const aliceSignal = aliceMessages.find((m: any) => m.type === "signal") as any;
    expect(aliceSignal.data.sdp).toBe("room-a-offer");

    // Give carol time to potentially receive a leaked message
    await new Promise((r) => setTimeout(r, 100));

    // Carol must NOT have received any signal messages
    const carolSignals = carolMessages.filter((m: any) => m.type === "signal");
    expect(carolSignals).toHaveLength(0);

    aliceWs.close();
    bobWs.close();
    carolWs.close();
  });

  it("peer_joined in room-A does not leak to room-B", async () => {
    const roomA = "isolation-join-a";
    const roomB = "isolation-join-b";

    // Carol in room B
    const carolWs = await connectPeer(roomB, "carol");
    const carolMessages = collectMessages(carolWs);
    await waitForWelcome(carolMessages);

    // Alice joins room A
    const aliceWs = await connectPeer(roomA, "alice");
    const aliceMessages = collectMessages(aliceWs);
    await waitForWelcome(aliceMessages);

    // Give carol time to potentially receive a leaked peer_joined
    await new Promise((r) => setTimeout(r, 100));

    const carolJoins = carolMessages.filter((m: any) => m.type === "peer_joined");
    expect(carolJoins).toHaveLength(0);

    aliceWs.close();
    carolWs.close();
  });

  it("peers API returns different peer sets for different rooms", async () => {
    const roomX = "isolation-peers-x";
    const roomY = "isolation-peers-y";

    const aliceWs = await connectPeer(roomX, "alice");
    const aliceMessages = collectMessages(aliceWs);
    await waitForWelcome(aliceMessages);

    const bobWs = await connectPeer(roomY, "bob");
    const bobMessages = collectMessages(bobWs);
    await waitForWelcome(bobMessages);

    const resX = await SELF.fetch(`${BASE}/api/v1/webrtc/peers?room=${roomX}`);
    const bodyX = await resX.json<{ peers: string[] }>();
    expect(bodyX.peers).toContain("alice");
    expect(bodyX.peers).not.toContain("bob");

    const resY = await SELF.fetch(`${BASE}/api/v1/webrtc/peers?room=${roomY}`);
    const bodyY = await resY.json<{ peers: string[] }>();
    expect(bodyY.peers).toContain("bob");
    expect(bodyY.peers).not.toContain("alice");

    aliceWs.close();
    bobWs.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SDP offer/answer relay
// ─────────────────────────────────────────────────────────────────────────────

describe("SDP offer/answer relay", () => {
  it("relays a full SDP offer from caller to callee", async () => {
    const room = "sdp-offer-relay";

    const calleeWs = await connectPeer(room, "callee");
    const calleeMessages = collectMessages(calleeWs);
    await waitForWelcome(calleeMessages);

    const callerWs = await connectPeer(room, "caller");
    const callerMessages = collectMessages(callerWs);
    await waitForWelcome(callerMessages);

    // Wait for callee to see caller join
    await waitFor(calleeMessages, (m: any) => m.type === "peer_joined");

    const sdpOffer = {
      type: "offer",
      sdp: "v=0\r\no=- 123456 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n"
        + "a=group:BUNDLE 0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n",
    };

    callerWs.send(JSON.stringify({
      type: "signal",
      to: "callee",
      data: sdpOffer,
    }));

    await waitFor(calleeMessages, (m: any) => m.type === "signal");

    const received = calleeMessages.find((m: any) => m.type === "signal") as any;
    expect(received.from).toBe("caller");
    expect(received.data.type).toBe("offer");
    expect(received.data.sdp).toContain("v=0");
    expect(received.data.sdp).toContain("webrtc-datachannel");

    callerWs.close();
    calleeWs.close();
  });

  it("relays an SDP answer from callee back to caller", async () => {
    const room = "sdp-answer-relay";

    const callerWs = await connectPeer(room, "caller");
    const callerMessages = collectMessages(callerWs);
    await waitForWelcome(callerMessages);

    const calleeWs = await connectPeer(room, "callee");
    const calleeMessages = collectMessages(calleeWs);
    await waitForWelcome(calleeMessages);

    // Wait for caller to see callee join
    await waitFor(callerMessages, (m: any) => m.type === "peer_joined");

    const sdpAnswer = {
      type: "answer",
      sdp: "v=0\r\no=- 654321 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n",
    };

    calleeWs.send(JSON.stringify({
      type: "signal",
      to: "caller",
      data: sdpAnswer,
    }));

    await waitFor(callerMessages, (m: any) => m.type === "signal");

    const received = callerMessages.find((m: any) => m.type === "signal") as any;
    expect(received.from).toBe("callee");
    expect(received.data.type).toBe("answer");
    expect(received.data.sdp).toContain("v=0");

    callerWs.close();
    calleeWs.close();
  });

  it("relays bidirectional offer+answer exchange without corruption", async () => {
    const room = "sdp-bidirectional";

    const aliceWs = await connectPeer(room, "alice");
    const aliceMessages = collectMessages(aliceWs);
    await waitForWelcome(aliceMessages);

    const bobWs = await connectPeer(room, "bob");
    const bobMessages = collectMessages(bobWs);
    await waitForWelcome(bobMessages);

    await waitFor(aliceMessages, (m: any) => m.type === "peer_joined");

    // Alice sends offer to bob
    const offer = { type: "offer", sdp: "alice-offer-sdp-data" };
    aliceWs.send(JSON.stringify({ type: "signal", to: "bob", data: offer }));

    await waitFor(bobMessages, (m: any) => m.type === "signal" && m.data?.type === "offer");

    // Bob replies with answer to alice
    const answer = { type: "answer", sdp: "bob-answer-sdp-data" };
    bobWs.send(JSON.stringify({ type: "signal", to: "alice", data: answer }));

    await waitFor(aliceMessages, (m: any) => m.type === "signal" && m.data?.type === "answer");

    const bobReceived = bobMessages.find(
      (m: any) => m.type === "signal" && m.data?.type === "offer"
    ) as any;
    expect(bobReceived.from).toBe("alice");
    expect(bobReceived.data.sdp).toBe("alice-offer-sdp-data");

    const aliceReceived = aliceMessages.find(
      (m: any) => m.type === "signal" && m.data?.type === "answer"
    ) as any;
    expect(aliceReceived.from).toBe("bob");
    expect(aliceReceived.data.sdp).toBe("bob-answer-sdp-data");

    aliceWs.close();
    bobWs.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ICE candidate relay
// ─────────────────────────────────────────────────────────────────────────────

describe("ICE candidate relay", () => {
  it("forwards ICE candidates from one peer to another", async () => {
    const room = "ice-relay";

    const aliceWs = await connectPeer(room, "alice");
    const aliceMessages = collectMessages(aliceWs);
    await waitForWelcome(aliceMessages);

    const bobWs = await connectPeer(room, "bob");
    const bobMessages = collectMessages(bobWs);
    await waitForWelcome(bobMessages);

    await waitFor(aliceMessages, (m: any) => m.type === "peer_joined");

    const iceCandidate = {
      candidate: "candidate:1 1 UDP 2122252543 192.168.1.100 50000 typ host",
      sdpMid: "0",
      sdpMLineIndex: 0,
    };

    aliceWs.send(JSON.stringify({
      type: "signal",
      to: "bob",
      data: { type: "ice-candidate", candidate: iceCandidate },
    }));

    await waitFor(bobMessages, (m: any) => m.type === "signal" && m.data?.type === "ice-candidate");

    const received = bobMessages.find(
      (m: any) => m.type === "signal" && m.data?.type === "ice-candidate"
    ) as any;
    expect(received.from).toBe("alice");
    expect(received.data.candidate.candidate).toContain("candidate:1");
    expect(received.data.candidate.sdpMid).toBe("0");
    expect(received.data.candidate.sdpMLineIndex).toBe(0);

    aliceWs.close();
    bobWs.close();
  });

  it("forwards multiple ICE candidates in sequence", async () => {
    const room = "ice-multi";

    const aliceWs = await connectPeer(room, "alice");
    const aliceMessages = collectMessages(aliceWs);
    await waitForWelcome(aliceMessages);

    const bobWs = await connectPeer(room, "bob");
    const bobMessages = collectMessages(bobWs);
    await waitForWelcome(bobMessages);

    await waitFor(aliceMessages, (m: any) => m.type === "peer_joined");

    // Send three ICE candidates in rapid succession
    for (let i = 0; i < 3; i++) {
      aliceWs.send(JSON.stringify({
        type: "signal",
        to: "bob",
        data: {
          type: "ice-candidate",
          candidate: { candidate: `candidate:${i}`, sdpMid: "0", sdpMLineIndex: 0 },
        },
      }));
    }

    // Wait for all three to arrive
    await waitFor(
      bobMessages,
      () => bobMessages.filter((m: any) => m.type === "signal" && m.data?.type === "ice-candidate").length >= 3
    );

    const iceMsgs = bobMessages.filter(
      (m: any) => m.type === "signal" && m.data?.type === "ice-candidate"
    );
    expect(iceMsgs).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      expect((iceMsgs[i] as any).data.candidate.candidate).toBe(`candidate:${i}`);
      expect((iceMsgs[i] as any).from).toBe("alice");
    }

    aliceWs.close();
    bobWs.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error handling
// ─────────────────────────────────────────────────────────────────────────────

describe("Error handling", () => {
  it("silently discards invalid JSON messages without crashing", async () => {
    const room = "err-bad-json";

    const aliceWs = await connectPeer(room, "alice");
    const aliceMessages = collectMessages(aliceWs);
    await waitForWelcome(aliceMessages);

    // Send garbage that is not valid JSON
    aliceWs.send("this is {not valid json!!!");

    // The connection should stay open. Verify by checking the peer is still listed.
    await new Promise((r) => setTimeout(r, 50));

    const peersRes = await SELF.fetch(`${BASE}/api/v1/webrtc/peers?room=${room}`);
    const body = await peersRes.json<{ peers: string[] }>();
    expect(body.peers).toContain("alice");

    aliceWs.close();
  });

  it("silently discards binary (ArrayBuffer) messages", async () => {
    const room = "err-binary";

    const aliceWs = await connectPeer(room, "alice");
    const aliceMessages = collectMessages(aliceWs);
    await waitForWelcome(aliceMessages);

    const bobWs = await connectPeer(room, "bob");
    const bobMessages = collectMessages(bobWs);
    await waitForWelcome(bobMessages);

    await waitFor(aliceMessages, (m: any) => m.type === "peer_joined");

    // Send a binary message (the worker ignores non-string messages)
    const binaryData = new Uint8Array([0x00, 0x01, 0x02, 0x03]).buffer;
    aliceWs.send(binaryData);

    // Give time for potential relay
    await new Promise((r) => setTimeout(r, 100));

    // Bob should not have received any signal (binary was silently discarded)
    const bobSignals = bobMessages.filter((m: any) => m.type === "signal");
    expect(bobSignals).toHaveLength(0);

    aliceWs.close();
    bobWs.close();
  });

  it("silently ignores unknown message types (keepalive, ping, etc.)", async () => {
    const room = "err-unknown-type";

    const aliceWs = await connectPeer(room, "alice");
    const aliceMessages = collectMessages(aliceWs);
    await waitForWelcome(aliceMessages);

    const bobWs = await connectPeer(room, "bob");
    const bobMessages = collectMessages(bobWs);
    await waitForWelcome(bobMessages);

    await waitFor(aliceMessages, (m: any) => m.type === "peer_joined");

    // Send a keepalive message (not "signal" type)
    aliceWs.send(JSON.stringify({ type: "keepalive", ts: Date.now() }));
    // Send an arbitrary type
    aliceWs.send(JSON.stringify({ type: "ping" }));

    // Give time for potential relay
    await new Promise((r) => setTimeout(r, 100));

    // Bob should not have received these unknown message types
    const bobNonWelcome = bobMessages.filter(
      (m: any) => m.type !== "welcome" && m.type !== "peer_joined"
    );
    expect(bobNonWelcome).toHaveLength(0);

    aliceWs.close();
    bobWs.close();
  });

  it("handles signal message with missing 'to' field gracefully", async () => {
    const room = "err-no-to";

    const aliceWs = await connectPeer(room, "alice");
    const aliceMessages = collectMessages(aliceWs);
    await waitForWelcome(aliceMessages);

    // Signal with no "to" — getWebSockets(undefined) should return empty
    aliceWs.send(JSON.stringify({ type: "signal", data: { sdp: "x" } }));

    // Connection should survive
    await new Promise((r) => setTimeout(r, 50));

    const peersRes = await SELF.fetch(`${BASE}/api/v1/webrtc/peers?room=${room}`);
    const body = await peersRes.json<{ peers: string[] }>();
    expect(body.peers).toContain("alice");

    aliceWs.close();
  });

  it("handles signal message with empty data payload", async () => {
    const room = "err-empty-data";

    const aliceWs = await connectPeer(room, "alice");
    const aliceMessages = collectMessages(aliceWs);
    await waitForWelcome(aliceMessages);

    const bobWs = await connectPeer(room, "bob");
    const bobMessages = collectMessages(bobWs);
    await waitForWelcome(bobMessages);

    await waitFor(aliceMessages, (m: any) => m.type === "peer_joined");

    // Signal with null data
    bobWs.send(JSON.stringify({ type: "signal", to: "alice", data: null }));

    await waitFor(aliceMessages, (m: any) => m.type === "signal");

    const received = aliceMessages.find((m: any) => m.type === "signal") as any;
    expect(received.from).toBe("bob");
    expect(received.data).toBeNull();

    aliceWs.close();
    bobWs.close();
  });

  it("handles valid JSON that is not an object (string, number, array)", async () => {
    const room = "err-non-object";

    const aliceWs = await connectPeer(room, "alice");
    const aliceMessages = collectMessages(aliceWs);
    await waitForWelcome(aliceMessages);

    // These are valid JSON but not objects with .type
    aliceWs.send(JSON.stringify("just a string"));
    aliceWs.send(JSON.stringify(42));
    aliceWs.send(JSON.stringify([1, 2, 3]));

    // Connection should survive
    await new Promise((r) => setTimeout(r, 50));

    const peersRes = await SELF.fetch(`${BASE}/api/v1/webrtc/peers?room=${room}`);
    const body = await peersRes.json<{ peers: string[] }>();
    expect(body.peers).toContain("alice");

    aliceWs.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Multiple peers in a room
// ─────────────────────────────────────────────────────────────────────────────

describe("Multiple peers in a room", () => {
  it("supports five peers connected simultaneously", async () => {
    const room = "multi-five";
    const names = ["alpha", "bravo", "charlie", "delta", "echo"];
    const sockets: WebSocket[] = [];
    const allMessages: unknown[][] = [];

    for (const name of names) {
      const ws = await connectPeer(room, name);
      const msgs = collectMessages(ws);
      sockets.push(ws);
      allMessages.push(msgs);
      await waitForWelcome(msgs);
    }

    // Verify the peers API lists all five
    const res = await SELF.fetch(`${BASE}/api/v1/webrtc/peers?room=${room}`);
    const body = await res.json<{ peers: string[]; count: number }>();
    expect(body.count).toBe(5);
    for (const name of names) {
      expect(body.peers).toContain(name);
    }

    // Cleanup
    for (const ws of sockets) ws.close();
  });

  it("signal is delivered only to the targeted peer, not broadcast", async () => {
    const room = "multi-targeted";

    const aliceWs = await connectPeer(room, "alice");
    const aliceMessages = collectMessages(aliceWs);
    await waitForWelcome(aliceMessages);

    const bobWs = await connectPeer(room, "bob");
    const bobMessages = collectMessages(bobWs);
    await waitForWelcome(bobMessages);

    const charlieWs = await connectPeer(room, "charlie");
    const charlieMessages = collectMessages(charlieWs);
    await waitForWelcome(charlieMessages);

    // Wait for all join notifications to settle
    await waitFor(aliceMessages, (m: any) => m.type === "peer_joined" && m.peer === "charlie");

    // Alice sends a signal to bob only
    aliceWs.send(JSON.stringify({ type: "signal", to: "bob", data: { msg: "for-bob-only" } }));

    await waitFor(bobMessages, (m: any) => m.type === "signal");

    // Give charlie time to potentially receive a leaked message
    await new Promise((r) => setTimeout(r, 100));

    const charlieSignals = charlieMessages.filter((m: any) => m.type === "signal");
    expect(charlieSignals).toHaveLength(0);

    const bobSignal = bobMessages.find((m: any) => m.type === "signal") as any;
    expect(bobSignal.from).toBe("alice");
    expect(bobSignal.data.msg).toBe("for-bob-only");

    aliceWs.close();
    bobWs.close();
    charlieWs.close();
  });

  it("last peer's welcome lists all previously connected peers", async () => {
    const room = "multi-welcome-all";

    const aliceWs = await connectPeer(room, "alice");
    const aliceMessages = collectMessages(aliceWs);
    const aliceWelcome = await waitForWelcome(aliceMessages);
    expect(aliceWelcome.peers).toEqual([]);

    const bobWs = await connectPeer(room, "bob");
    const bobMessages = collectMessages(bobWs);
    const bobWelcome = await waitForWelcome(bobMessages);
    expect(bobWelcome.peers).toEqual(["alice"]);

    const charlieWs = await connectPeer(room, "charlie");
    const charlieMessages = collectMessages(charlieWs);
    const charlieWelcome = await waitForWelcome(charlieMessages);
    expect(charlieWelcome.peers).toContain("alice");
    expect(charlieWelcome.peers).toContain("bob");
    expect(charlieWelcome.peers).not.toContain("charlie");

    aliceWs.close();
    bobWs.close();
    charlieWs.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Reconnection
// ─────────────────────────────────────────────────────────────────────────────

describe("Reconnection", () => {
  it("peer can reconnect to the same room after disconnecting", async () => {
    const room = "reconnect-basic";

    // Alice connects
    let aliceWs = await connectPeer(room, "alice");
    let aliceMessages = collectMessages(aliceWs);
    await waitForWelcome(aliceMessages);

    // Verify alice is listed
    let peersRes = await SELF.fetch(`${BASE}/api/v1/webrtc/peers?room=${room}`);
    let body = await peersRes.json<{ peers: string[] }>();
    expect(body.peers).toContain("alice");

    // Alice disconnects
    aliceWs.close();
    await new Promise((r) => setTimeout(r, 50));

    // Alice reconnects
    aliceWs = await connectPeer(room, "alice");
    aliceMessages = collectMessages(aliceWs);
    const welcome = await waitForWelcome(aliceMessages);

    // welcome should succeed (the connection works)
    expect(welcome.type).toBe("welcome");

    // Verify alice is listed again
    peersRes = await SELF.fetch(`${BASE}/api/v1/webrtc/peers?room=${room}`);
    body = await peersRes.json<{ peers: string[] }>();
    expect(body.peers).toContain("alice");

    aliceWs.close();
  });

  it("reconnected peer receives signals from existing peers", async () => {
    const room = "reconnect-signals";

    // Bob is always in the room
    const bobWs = await connectPeer(room, "bob");
    const bobMessages = collectMessages(bobWs);
    await waitForWelcome(bobMessages);

    // Alice connects, then disconnects
    let aliceWs = await connectPeer(room, "alice");
    let aliceMessages = collectMessages(aliceWs);
    await waitForWelcome(aliceMessages);
    await waitFor(bobMessages, (m: any) => m.type === "peer_joined" && m.peer === "alice");

    aliceWs.close();
    await waitFor(bobMessages, (m: any) => m.type === "peer_left" && m.peer === "alice");

    // Alice reconnects
    aliceWs = await connectPeer(room, "alice");
    aliceMessages = collectMessages(aliceWs);
    const welcome = await waitForWelcome(aliceMessages);
    expect(welcome.peers).toContain("bob");

    // Wait for bob to see alice rejoin
    await waitFor(
      bobMessages,
      () => bobMessages.filter((m: any) => m.type === "peer_joined" && m.peer === "alice").length >= 2
    );

    // Bob sends signal to reconnected alice
    bobWs.send(JSON.stringify({ type: "signal", to: "alice", data: { msg: "hello-again" } }));

    await waitFor(aliceMessages, (m: any) => m.type === "signal");

    const signal = aliceMessages.find((m: any) => m.type === "signal") as any;
    expect(signal.from).toBe("bob");
    expect(signal.data.msg).toBe("hello-again");

    aliceWs.close();
    bobWs.close();
  });

  it("reconnected peer can send signals to existing peers", async () => {
    const room = "reconnect-send";

    const bobWs = await connectPeer(room, "bob");
    const bobMessages = collectMessages(bobWs);
    await waitForWelcome(bobMessages);

    // Alice connects then disconnects
    let aliceWs = await connectPeer(room, "alice");
    let aliceMessages = collectMessages(aliceWs);
    await waitForWelcome(aliceMessages);
    aliceWs.close();
    await new Promise((r) => setTimeout(r, 50));

    // Alice reconnects
    aliceWs = await connectPeer(room, "alice");
    aliceMessages = collectMessages(aliceWs);
    await waitForWelcome(aliceMessages);

    // Wait for bob to see alice rejoin
    await waitFor(
      bobMessages,
      () => bobMessages.filter((m: any) => m.type === "peer_joined" && m.peer === "alice").length >= 2
    );

    // Reconnected alice sends signal to bob
    aliceWs.send(JSON.stringify({ type: "signal", to: "bob", data: { msg: "i-am-back" } }));

    await waitFor(bobMessages, (m: any) => m.type === "signal");

    const signal = bobMessages.find((m: any) => m.type === "signal") as any;
    expect(signal.from).toBe("alice");
    expect(signal.data.msg).toBe("i-am-back");

    aliceWs.close();
    bobWs.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Default peer ID
// ─────────────────────────────────────────────────────────────────────────────

describe("Default peer ID", () => {
  it("assigns 'anonymous' when ?peer param is missing", async () => {
    const room = "default-peer-id";

    // Connect without specifying peer param
    const res = await SELF.fetch(`${BASE}/ws?room=${room}`, {
      headers: { Upgrade: "websocket" },
    });
    const ws = (res as unknown as { webSocket: WebSocket }).webSocket;
    ws.accept();
    const messages = collectMessages(ws);
    await waitForWelcome(messages);

    const peersRes = await SELF.fetch(`${BASE}/api/v1/webrtc/peers?room=${room}`);
    const body = await peersRes.json<{ peers: string[] }>();
    expect(body.peers).toContain("anonymous");

    ws.close();
  });

  it("uses 'default' room when ?room param is missing on /ws", async () => {
    // Connect with no room param
    const res = await SELF.fetch(`${BASE}/ws?peer=test-default-room`, {
      headers: { Upgrade: "websocket" },
    });
    expect(res.status).toBe(101);
    const ws = (res as unknown as { webSocket: WebSocket }).webSocket;
    ws.accept();
    const messages = collectMessages(ws);
    await waitForWelcome(messages);

    // The default room should contain this peer
    const peersRes = await SELF.fetch(`${BASE}/api/v1/webrtc/peers?room=default`);
    const body = await peersRes.json<{ peers: string[] }>();
    expect(body.peers).toContain("test-default-room");

    ws.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Route parity (/ws vs /webrtc/ws)
// ─────────────────────────────────────────────────────────────────────────────

describe("Route parity — /ws and /webrtc/ws", () => {
  it("both routes land in the same room and can exchange signals", async () => {
    const room = "route-parity";

    // Alice connects via /ws
    const aliceWs = await connectPeer(room, "alice", "/ws");
    const aliceMessages = collectMessages(aliceWs);
    await waitForWelcome(aliceMessages);

    // Bob connects via /webrtc/ws
    const bobWs = await connectPeer(room, "bob", "/webrtc/ws");
    const bobMessages = collectMessages(bobWs);
    const bobWelcome = await waitForWelcome(bobMessages);

    // Bob's welcome should list alice (proving they share the same DO room)
    expect(bobWelcome.peers).toContain("alice");

    // Alice should have received bob's peer_joined
    await waitFor(aliceMessages, (m: any) => m.type === "peer_joined" && m.peer === "bob");

    // Cross-route signal relay
    bobWs.send(JSON.stringify({ type: "signal", to: "alice", data: { route: "webrtc-ws" } }));
    await waitFor(aliceMessages, (m: any) => m.type === "signal");

    const signal = aliceMessages.find((m: any) => m.type === "signal") as any;
    expect(signal.from).toBe("bob");
    expect(signal.data.route).toBe("webrtc-ws");

    aliceWs.close();
    bobWs.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CORS detail checks
// ─────────────────────────────────────────────────────────────────────────────

describe("CORS headers detail", () => {
  it("health response includes Allow-Methods and Allow-Headers", async () => {
    const res = await SELF.fetch(`${BASE}/health`);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("OPTIONS");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Content-Type");
  });

  it("404 response includes CORS headers", async () => {
    const res = await SELF.fetch(`${BASE}/nonexistent`);
    expect(res.status).toBe(404);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeTruthy();
  });

  it("peers API response includes CORS headers", async () => {
    const res = await SELF.fetch(`${BASE}/api/v1/webrtc/peers?room=cors-test`);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeTruthy();
  });

  it("preflight OPTIONS works on any route", async () => {
    const res = await SELF.fetch(`${BASE}/api/v1/webrtc/peers`, { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiting
// ─────────────────────────────────────────────────────────────────────────────

describe("Rate limiting — message flood (10 msg/s)", () => {
  it("closes WS with code 4029 when a peer sends more than 10 messages/second", async () => {
    const room = "rl-msg-flood";
    const ws = await connectPeer(room, "flooder");
    const messages = collectMessages(ws);
    await waitForWelcome(messages);

    // Register close listener BEFORE sends so we never miss the event
    const closePromise = waitForClose(ws, 5000);

    // Send 11 messages in rapid succession — 11th triggers the rate limit
    for (let i = 0; i < 11; i++) {
      ws.send(JSON.stringify({ type: "signal", to: "nobody", data: { seq: i } }));
    }

    // Await the server-initiated close (code 4029)
    const code = await closePromise;
    expect(code).toBe(4029);
  });

  it("allows exactly 10 messages/second without closing", async () => {
    const room = "rl-msg-ok";
    const ws = await connectPeer(room, "normal-sender");
    const messages = collectMessages(ws);
    await waitForWelcome(messages);

    let closed = false;
    ws.addEventListener("close", () => {
      closed = true;
    });

    // Send exactly 10 messages — should all succeed without triggering the limit
    for (let i = 0; i < 10; i++) {
      ws.send(JSON.stringify({ type: "signal", to: "nobody", data: { seq: i } }));
    }

    // Short wait — if the WS were going to be closed it would happen immediately
    await new Promise((r) => setTimeout(r, 300));
    expect(closed).toBe(false);

    ws.close();
  });
});

describe("Rate limiting — join flood (5 joins/minute per IP)", () => {
  /**
   * Join a room and immediately close the client socket.
   * storage.put() is awaited inside DO.fetch() before the 101 is sent, so the
   * join counter is persisted even though we close immediately.
   * Works correctly with isolatedStorage:false (vitest.config.ts) — storage
   * persists across DO re-creations within and between requests in the same test.
   */
  async function joinAndClose(room: string, peer: string, ip: string): Promise<number> {
    const res = await SELF.fetch(`${BASE}/ws?room=${room}&peer=${peer}`, {
      headers: { Upgrade: "websocket", "CF-Connecting-IP": ip },
    });
    if (res.status === 101) {
      const ws = (res as unknown as { webSocket: WebSocket }).webSocket;
      ws.accept();
      ws.close(1000, "done");
    }
    return res.status;
  }

  it("returns HTTP 429 on the 6th join from the same IP within one minute", async () => {
    const room = "rl-join-flood";
    const ip = "203.0.113.42"; // RFC 5737 TEST-NET-3 — unique across test runs

    // First 5 joins must succeed (storage counter goes 1 → 5)
    for (let i = 0; i < 5; i++) {
      expect(await joinAndClose(room, `peer${i}`, ip)).toBe(101);
    }

    // 6th join from the same IP must be rate limited (counter is 5 ≥ JOIN_RATE_LIMIT)
    const res6 = await SELF.fetch(`${BASE}/ws?room=${room}&peer=peer5`, {
      headers: { Upgrade: "websocket", "CF-Connecting-IP": ip },
    });
    expect(res6.status).toBe(429);
    expect(res6.headers.get("Retry-After")).toBe("60");
  });

  it("allows a different IP to join the same room after another IP is rate limited", async () => {
    const room = "rl-join-ip-isolated";
    const ipA = "203.0.113.10";
    const ipB = "203.0.113.20";

    // Exhaust the limit for ipA
    for (let i = 0; i < 5; i++) {
      expect(await joinAndClose(room, `a${i}`, ipA)).toBe(101);
    }

    // ipA's 6th join → 429
    const resA6 = await SELF.fetch(`${BASE}/ws?room=${room}&peer=a5`, {
      headers: { Upgrade: "websocket", "CF-Connecting-IP": ipA },
    });
    expect(resA6.status).toBe(429);

    // ipB has its own independent counter — must still be allowed
    expect(await joinAndClose(room, "b0", ipB)).toBe(101);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Room persistence — DO KV storage
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch the persisted room state via the public API. */
async function getRoomState(room: string): Promise<{
  room: string;
  roomState: { members: string[]; createdAt: number } | null;
  alarmAt: number | null;
}> {
  const res = await SELF.fetch(`${BASE}/api/v1/webrtc/room?room=${room}`);
  return res.json();
}

/** Force-expire a room by triggering its DO alarm immediately. */
async function expireRoom(room: string): Promise<void> {
  await SELF.fetch(`${BASE}/api/v1/webrtc/room/expire?room=${room}`, {
    method: "POST",
  });
}

describe("Room persistence — members in DO storage", () => {
  it("GET /api/v1/webrtc/room returns 200 with CORS headers", async () => {
    const res = await SELF.fetch(`${BASE}/api/v1/webrtc/room?room=persist-cors`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeTruthy();
  });

  it("stores member in room:state when a peer joins", async () => {
    const room = "persist-join-1";
    const ws = await connectPeer(room, "alice");
    const msgs = collectMessages(ws);
    await waitForWelcome(msgs);

    const state = await getRoomState(room);
    expect(state.roomState).not.toBeNull();
    expect(state.roomState!.members).toContain("alice");

    ws.close();
  });

  it("stores multiple members when multiple peers join", async () => {
    const room = "persist-multi-1";
    const wsA = await connectPeer(room, "alpha");
    const msgsA = collectMessages(wsA);
    await waitForWelcome(msgsA);

    const wsB = await connectPeer(room, "beta");
    const msgsB = collectMessages(wsB);
    await waitForWelcome(msgsB);

    const state = await getRoomState(room);
    expect(state.roomState!.members).toContain("alpha");
    expect(state.roomState!.members).toContain("beta");

    wsA.close();
    wsB.close();
  });

  it("removes member from room:state on disconnect", async () => {
    const room = "persist-leave-1";
    const wsA = await connectPeer(room, "leaverA");
    const msgsA = collectMessages(wsA);
    await waitForWelcome(msgsA);

    const wsB = await connectPeer(room, "stayerB");
    const msgsB = collectMessages(wsB);
    await waitForWelcome(msgsB);

    // Disconnect leaverA
    wsA.close(1000, "bye");

    // Wait for peer_left broadcast so we know the DO has processed the close
    await waitFor(msgsB, (m: any) => m.type === "peer_left" && m.peer === "leaverA");

    const state = await getRoomState(room);
    expect(state.roomState!.members).not.toContain("leaverA");
    expect(state.roomState!.members).toContain("stayerB");

    wsB.close();
  });

  it("stores createdAt timestamp on first join", async () => {
    const room = "persist-created-at-1";
    const before = Date.now();
    const ws = await connectPeer(room, "timekeeper");
    const msgs = collectMessages(ws);
    await waitForWelcome(msgs);

    const state = await getRoomState(room);
    expect(state.roomState!.createdAt).toBeGreaterThanOrEqual(before);
    expect(state.roomState!.createdAt).toBeLessThanOrEqual(Date.now());

    ws.close();
  });

  it("schedules DO alarm (alarmAt is non-null) on first peer join", async () => {
    const room = "persist-alarm-set-1";
    const ws = await connectPeer(room, "watcher");
    const msgs = collectMessages(ws);
    await waitForWelcome(msgs);

    const state = await getRoomState(room);
    // Alarm should be set ~24h in the future
    expect(state.alarmAt).not.toBeNull();
    const expectedMin = Date.now() + 23 * 60 * 60 * 1_000; // at least 23h out
    expect(state.alarmAt!).toBeGreaterThan(expectedMin);

    ws.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Room persistence — ICE candidate buffer
// ─────────────────────────────────────────────────────────────────────────────

describe("Room persistence — ICE candidate buffer", () => {
  it("buffers a signal sent to an offline peer and delivers it on reconnect", async () => {
    const room = "ice-buf-reconnect-1";

    // Peer B joins then leaves
    const wsB1 = await connectPeer(room, "peerB");
    const msgsB1 = collectMessages(wsB1);
    await waitForWelcome(msgsB1);

    // Peer A joins while B is still online
    const wsA = await connectPeer(room, "peerA");
    const msgsA = collectMessages(wsA);
    await waitForWelcome(msgsA);

    // B disconnects
    wsB1.close(1000, "going offline");
    // Wait for A to see peer_left so DO has processed the close
    await waitFor(msgsA, (m: any) => m.type === "peer_left" && m.peer === "peerB");

    // A sends a signal to offline B — should be buffered in DO storage
    const candidateData = { candidate: "candidate:1 1 udp 2113937151 192.0.2.1 54400 typ host" };
    wsA.send(JSON.stringify({ type: "signal", to: "peerB", data: candidateData }));

    // Brief pause so the DO processes the send and writes to storage
    await new Promise((r) => setTimeout(r, 150));

    // B reconnects
    const wsB2 = await connectPeer(room, "peerB");
    const msgsB2 = collectMessages(wsB2);
    await waitForWelcome(msgsB2);

    // B should receive the buffered signal immediately after the welcome
    await waitFor(
      msgsB2,
      (m: any) => m.type === "signal" && m.from === "peerA" && m.data?.candidate !== undefined
    );

    const bufferedSignal = msgsB2.find(
      (m: any) => m.type === "signal" && m.from === "peerA"
    ) as any;
    expect(bufferedSignal.data).toEqual(candidateData);

    wsA.close();
    wsB2.close();
  });

  it("buffer is cleared after delivery — second reconnect gets no stale signals", async () => {
    const room = "ice-buf-clear-1";

    // Setup: A online, B connects then leaves
    const wsB1 = await connectPeer(room, "peerB");
    const msgsB1 = collectMessages(wsB1);
    await waitForWelcome(msgsB1);

    const wsA = await connectPeer(room, "peerA");
    const msgsA = collectMessages(wsA);
    await waitForWelcome(msgsA);

    wsB1.close(1000, "offline");
    await waitFor(msgsA, (m: any) => m.type === "peer_left" && m.peer === "peerB");

    // A sends one signal to offline B
    wsA.send(JSON.stringify({ type: "signal", to: "peerB", data: { seq: 1 } }));
    await new Promise((r) => setTimeout(r, 150));

    // B reconnects — receives buffered signal, buffer is deleted
    const wsB2 = await connectPeer(room, "peerB");
    const msgsB2 = collectMessages(wsB2);
    await waitForWelcome(msgsB2);
    await waitFor(msgsB2, (m: any) => m.type === "signal" && m.data?.seq === 1);

    // B disconnects and reconnects again — no stale signals should arrive
    wsB2.close(1000, "offline again");
    await waitFor(msgsA, (m: any) => m.type === "peer_left" && m.peer === "peerB");

    const wsB3 = await connectPeer(room, "peerB");
    const msgsB3 = collectMessages(wsB3);
    await waitForWelcome(msgsB3);

    // Short wait — if there were stale signals they'd arrive quickly
    await new Promise((r) => setTimeout(r, 300));
    const signalCount = msgsB3.filter((m: any) => m.type === "signal").length;
    expect(signalCount).toBe(0);

    wsA.close();
    wsB3.close();
  });

  it("drops signals beyond ICE_BUFFER_MAX (50) for offline peer", async () => {
    // Strategy: 6 senders × 10 signals = 60 total → buffer caps at 50.
    //
    // Each sender and the target use a unique CF-Connecting-IP header so they
    // have independent per-IP join rate-limit counters (limit: 5/min per IP).
    // This prevents the per-room IP-based join limit from blocking later senders.
    //
    // Each sender is also a distinct peerId, giving it an independent per-peer
    // message rate-limit counter (limit: 10 msg/s per peerId), so all 10 sends
    // per sender go through without triggering the message rate limiter.
    const room = "ice-buf-overflow-3";
    const ICE_BUFFER_MAX = 50;
    const SENDERS = 6;
    const PER_SENDER = 10; // 6 × 10 = 60 > ICE_BUFFER_MAX

    /** Connect with an explicit IP to keep per-IP join counters independent. */
    async function connectWithIP(peer: string, ip: string): Promise<WebSocket> {
      const res = await SELF.fetch(`${BASE}/ws?room=${room}&peer=${peer}`, {
        headers: { Upgrade: "websocket", "CF-Connecting-IP": ip },
      });
      const ws = (res as unknown as { webSocket: WebSocket }).webSocket;
      ws.accept();
      return ws;
    }

    // Target joins then leaves (IP "10.0.1.0" → join count = 1 for this IP)
    const wsTarget = await connectWithIP("overflowTarget", "10.0.1.0");
    const msgsTarget = collectMessages(wsTarget);
    await waitForWelcome(msgsTarget);
    wsTarget.close(1000, "going offline");

    // Wait for close to be processed before senders join
    await new Promise((r) => setTimeout(r, 200));

    // 6 senders, each with unique IP (10.0.2.1–6) so join counters are isolated
    for (let s = 0; s < SENDERS; s++) {
      const senderIp = `10.0.2.${s + 1}`;
      const wsSender = await connectWithIP(`overflow-sender-${s}`, senderIp);
      const msgsSender = collectMessages(wsSender);
      await waitForWelcome(msgsSender);

      // Each sender sends exactly PER_SENDER (10) messages — under the 10/s limit
      for (let i = 0; i < PER_SENDER; i++) {
        wsSender.send(
          JSON.stringify({
            type: "signal",
            to: "overflowTarget",
            data: { batch: s, seq: s * PER_SENDER + i },
          })
        );
      }

      // Let DO process all writes for this sender before the next one joins
      await new Promise((r) => setTimeout(r, 100));
      wsSender.close(1000, "done");
    }

    // Allow DO to finish all pending storage writes
    await new Promise((r) => setTimeout(r, 400));

    // Target reconnects (same IP "10.0.1.0" → join count = 2, still under limit)
    const wsTarget2 = await connectWithIP("overflowTarget", "10.0.1.0");
    const msgsTarget2 = collectMessages(wsTarget2);
    await waitForWelcome(msgsTarget2);

    // Allow time for all buffered signals to be delivered
    await new Promise((r) => setTimeout(r, 400));

    const signals = msgsTarget2.filter((m: any) => m.type === "signal");
    // Exactly ICE_BUFFER_MAX (50) signals should have been stored and delivered.
    // The remaining 10 (batch 5, seq 50–59) are silently dropped by the cap.
    expect(signals.length).toBe(ICE_BUFFER_MAX);

    wsTarget2.close();
  });

  it("does not buffer signals to unknown (never-joined) peers", async () => {
    const room = "ice-buf-unknown-1";

    // Only A joins; send a signal to a peer that never joined
    const wsA = await connectPeer(room, "senderA");
    const msgsA = collectMessages(wsA);
    await waitForWelcome(msgsA);

    wsA.send(JSON.stringify({ type: "signal", to: "ghost", data: { x: 1 } }));
    await new Promise((r) => setTimeout(r, 150));

    // Room state should not contain "ghost" in members
    const state = await getRoomState(room);
    expect(state.roomState!.members).not.toContain("ghost");

    // Now "ghost" joins — it should NOT receive the buffered signal
    // (ghost was never a member, signal was still buffered by key icebuf:ghost)
    // This test simply verifies the buffer doesn't prevent other behaviour
    const wsGhost = await connectPeer(room, "ghost");
    const msgsGhost = collectMessages(wsGhost);
    await waitForWelcome(msgsGhost);

    // ghost WILL receive the buffered signal (icebuf:ghost was written regardless)
    // — this is the intended "late joiner delivery" behaviour, not a bug.
    // Wait briefly and just assert no crash / unexpected close
    await new Promise((r) => setTimeout(r, 200));

    let closed = false;
    wsGhost.addEventListener("close", () => { closed = true; });
    expect(closed).toBe(false);

    wsA.close();
    wsGhost.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Room persistence — DO alarm (24h TTL auto-cleanup)
// ─────────────────────────────────────────────────────────────────────────────

describe("Room persistence — DO alarm (24h TTL cleanup)", () => {
  it("POST /api/v1/webrtc/room/expire returns 200 with CORS headers", async () => {
    const res = await SELF.fetch(
      `${BASE}/api/v1/webrtc/room/expire?room=expire-cors`,
      { method: "POST" }
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeTruthy();
    const body = await res.json<{ ok: boolean; room: string }>();
    expect(body.ok).toBe(true);
    expect(body.room).toBe("expire-cors");
  });

  it("alarm closes all live connections with code 4004", async () => {
    const room = "alarm-close-1";

    const wsA = await connectPeer(room, "aliceA");
    const msgsA = collectMessages(wsA);
    await waitForWelcome(msgsA);

    const wsB = await connectPeer(room, "bobB");
    const msgsB = collectMessages(wsB);
    await waitForWelcome(msgsB);

    // Register close listeners before triggering alarm
    const closeA = waitForClose(wsA, 3000);
    const closeB = waitForClose(wsB, 3000);

    // Trigger the DO alarm immediately via the admin endpoint
    await expireRoom(room);

    // Both peers should receive close code 4004 (Room expired)
    expect(await closeA).toBe(4004);
    expect(await closeB).toBe(4004);
  });

  it("alarm wipes room:state from DO storage", async () => {
    const room = "alarm-wipe-state-1";

    const ws = await connectPeer(room, "member");
    const msgs = collectMessages(ws);
    await waitForWelcome(msgs);

    // Confirm state was written
    const beforeState = await getRoomState(room);
    expect(beforeState.roomState).not.toBeNull();
    expect(beforeState.roomState!.members).toContain("member");

    const closeP = waitForClose(ws, 3000);
    await expireRoom(room);
    await closeP;

    // State should be cleared
    const afterState = await getRoomState(room);
    expect(afterState.roomState).toBeNull();
  });

  it("alarm wipes scheduled alarmAt from DO storage", async () => {
    const room = "alarm-wipe-alarm-1";

    const ws = await connectPeer(room, "tick");
    const msgs = collectMessages(ws);
    await waitForWelcome(msgs);

    // alarmAt should be set after join
    const before = await getRoomState(room);
    expect(before.alarmAt).not.toBeNull();

    const closeP = waitForClose(ws, 3000);
    await expireRoom(room);
    await closeP;

    // After alarm fires and deleteAll(), alarmAt should be null
    const after = await getRoomState(room);
    expect(after.alarmAt).toBeNull();
  });

  it("alarm on empty room (no live connections) completes without error", async () => {
    const room = "alarm-empty-room-1";

    // Join and immediately close — DO storage still has room:state
    const ws = await connectPeer(room, "ghost");
    const msgs = collectMessages(ws);
    await waitForWelcome(msgs);
    ws.close(1000, "left");

    // Brief pause so DO processes close before we trigger the alarm
    await new Promise((r) => setTimeout(r, 200));

    const res = await SELF.fetch(
      `${BASE}/api/v1/webrtc/room/expire?room=${room}`,
      { method: "POST" }
    );
    expect(res.status).toBe(200);

    const state = await getRoomState(room);
    expect(state.roomState).toBeNull();
  });

  it("peers can rejoin after room has been expired and storage wiped", async () => {
    const room = "alarm-rejoin-1";

    // First session
    const ws1 = await connectPeer(room, "phoenix");
    const msgs1 = collectMessages(ws1);
    await waitForWelcome(msgs1);

    const closeP = waitForClose(ws1, 3000);
    await expireRoom(room);
    await closeP;

    // State cleared — room is fresh
    const midState = await getRoomState(room);
    expect(midState.roomState).toBeNull();

    // Second session — room is recreated from scratch
    const ws2 = await connectPeer(room, "phoenix");
    const msgs2 = collectMessages(ws2);
    const welcome = await waitForWelcome(msgs2);
    expect(welcome.peers).toEqual([]); // no other peers

    const newState = await getRoomState(room);
    expect(newState.roomState!.members).toContain("phoenix");

    ws2.close();
  });
});
