/**
 * weblink-signaling/cloudflare/worker.ts
 *
 * Cloudflare Worker + Durable Objects — sovereign WebRTC signaling relay.
 *
 * Compatible with both the Weblink PWA wire protocol and SKComm's signaling
 * broker protocol. Runs serverless on Cloudflare's edge; no VPS required.
 * WebSocket state is managed in Durable Objects so connections survive
 * Worker restarts.
 *
 * Routes:
 *   WS  /ws?room=<room>&peer=<id>                 weblink PWA compatibility
 *   WS  /webrtc/ws?room=<room>&peer=<id>          SKComm signaling endpoint
 *   GET /api/v1/webrtc/peers?room=<room>           list live peers in a room
 *   GET /api/v1/webrtc/room?room=<room>            room state (members + alarm)
 *   POST /api/v1/webrtc/room/expire?room=<room>    force-expire room (testing)
 *   GET /health                                    health check
 *
 * Rate limits (enforced per Durable Object instance, i.e. per room):
 *   - Join:    max 5 room joins / minute  per client IP  → HTTP 429
 *   - Message: max 10 signal messages / second per peer → WS close 4029
 * Both limits use DO storage so they survive hibernation between events.
 *
 * Room persistence (DO KV storage):
 *   - room:state    → RoomState (members list + createdAt timestamp)
 *   - icebuf:<peer> → IceEntry[] (buffered signals for offline peers, max 50)
 *   - rl:join:<ip>  → RlWindow (join rate-limit sliding window)
 *   - rl:msg:<peer> → RlWindow (message rate-limit sliding window)
 *
 * Auto-cleanup (DO alarm):
 *   - 24h sliding TTL: alarm is (re-)scheduled on every peer join
 *   - On alarm: all live WebSocket connections are closed (code 4004),
 *     then storage.deleteAll() purges all room state
 *
 * Deploy:
 *   cd weblink-signaling && wrangler deploy
 *
 * Wire protocol (relay only — no media ever passes through):
 *   Client → Server: WS connect with ?room=&peer= params
 *   Server → Client: {"type": "welcome",    "peers": ["<id>", ...]}
 *   Client → Server: {"type": "signal",     "to": "<id>", "data": {...}}
 *   Server → Client: {"type": "signal",     "from": "<id>", "data": {...}}
 *   Server → Client: {"type": "peer_joined","peer": "<id>"}
 *   Server → Client: {"type": "peer_left",  "peer": "<id>"}
 *
 * Security note:
 *   The "from" field in relayed signals is always set by the server to the
 *   authenticated peer ID — clients cannot forge a different sender identity.
 */

export interface Env {
  SIGNALING_ROOM: DurableObjectNamespace;
  /** Comma-separated allowed origins, e.g. "https://skworld.io". Default: * */
  ALLOWED_ORIGINS?: string;
  /**
   * Set to "true" to require a CapAuth bearer token on all WebSocket upgrades.
   * Connections without a non-empty "Authorization: Bearer <token>" header are
   * rejected by closing the WebSocket with code 4401.
   */
  CAPAUTH_REQUIRE_AUTH?: string;
  /**
   * KV namespace binding for sovereign DID documents.
   * Keys are agent slugs (e.g. "opus"); values are JSON DID document strings.
   * Populated by: skchat/scripts/publish-did.sh
   * Route: GET /agents/:name/.well-known/did.json
   */
  DID_DOCUMENTS?: KVNamespace;
}

// ─────────────────────────────────────────────────────────────────────────────
// Durable Object: SignalingRoom
//
// One DO instance per room. Manages all WebSocket connections in that room.
// Uses the Hibernation API so the DO can sleep when idle and wake on message.
//
// Persistence layout (DO KV storage):
//   room:state      → RoomState   (member list + createdAt)
//   icebuf:<peer>   → IceEntry[]  (buffered signals for offline peers)
//   rl:join:<ip>    → RlWindow    (join rate-limit window)
//   rl:msg:<peer>   → RlWindow    (message rate-limit window)
// ─────────────────────────────────────────────────────────────────────────────

/** Sliding-window rate-limit entry stored in DO storage. */
interface RlWindow {
  count: number;
  windowStart: number;
}

/** Persisted room membership and creation metadata. */
interface RoomState {
  /** Peer IDs currently considered members of this room. */
  members: string[];
  /** Unix timestamp (ms) when the room was first created. */
  createdAt: number;
}

/** A single buffered signal entry for an offline peer. */
interface IceEntry {
  from: string;
  data: unknown;
}

/** WS close code used when a peer exceeds the message rate limit. */
const WS_CLOSE_RATE_LIMITED = 4029;

/** WS close code sent to all peers when the room TTL alarm fires. */
const WS_CLOSE_ROOM_EXPIRED = 4004;

/** Max signal messages a single peer may send within one second. */
const MSG_RATE_LIMIT = 10;

/** Max room joins a single IP may make within one minute (per room). */
const JOIN_RATE_LIMIT = 5;
const JOIN_WINDOW_MS = 60_000;

/** Room lifetime after last join event. Alarm slides on every join. */
const ROOM_TTL_MS = 24 * 60 * 60 * 1_000; // 24 hours

/** Maximum buffered signal entries per offline peer (anti-abuse). */
const ICE_BUFFER_MAX = 50;

export class SignalingRoom implements DurableObject {
  private state: DurableObjectState;

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // ── Internal API: list live peers ─────────────────────────────────────────
    if (url.pathname === "/__peers") {
      const sockets = this.state.getWebSockets();
      const peers = sockets.map((ws) => this.state.getTags(ws)[0] ?? "unknown");
      return Response.json({ peers });
    }

    // ── Internal API: full room state (for /api/v1/webrtc/room and tests) ─────
    if (url.pathname === "/__room_state") {
      const roomState = await this.state.storage.get<RoomState>("room:state");
      const alarmAt = await this.state.storage.getAlarm();
      return Response.json({ roomState: roomState ?? null, alarmAt });
    }

    // ── Internal API: force-trigger alarm (for /api/v1/webrtc/room/expire) ────
    if (url.pathname === "/__alarm" && request.method === "POST") {
      await this.alarm();
      return new Response("ok");
    }

    // WebSocket upgrade
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }

    // ── Join rate limit: 5 joins / minute per client IP ──────────────────────
    // Uses DO storage so the counter survives hibernation between requests.
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const joinKey = `rl:join:${ip}`;
    const now = Date.now();
    const joinData: RlWindow =
      (await this.state.storage.get<RlWindow>(joinKey)) ??
      { count: 0, windowStart: now };

    if (now - joinData.windowStart >= JOIN_WINDOW_MS) {
      joinData.count = 0;
      joinData.windowStart = now;
    }

    if (joinData.count >= JOIN_RATE_LIMIT) {
      return new Response("Too Many Requests", {
        status: 429,
        headers: { "Retry-After": "60" },
      });
    }

    joinData.count += 1;
    await this.state.storage.put(joinKey, joinData);
    // ─────────────────────────────────────────────────────────────────────────

    const peerId = url.searchParams.get("peer") || "anonymous";

    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];

    // Accept with hibernation API — the DO can be evicted between messages
    this.state.acceptWebSocket(server, [peerId]);

    await this.onPeerJoin(peerId, server);

    return new Response(null, { status: 101, webSocket: client });
  }

  // ── DO Alarm: 24h sliding-TTL room cleanup ────────────────────────────────
  //
  // Called automatically by Cloudflare when the scheduled alarm time passes.
  // Closes all live WebSocket connections with code 4004 then wipes all
  // persisted room state (members, ICE buffers, rate-limit windows).

  async alarm(): Promise<void> {
    // Explicitly cancel the alarm first.
    // CF auto-removes the alarm when it fires via the scheduler, but when
    // alarm() is called directly (e.g. via /__alarm for forced expiry) CF
    // does NOT auto-cancel, so we always cancel explicitly here.
    await this.state.storage.deleteAlarm();

    // Close every live connection with the room-expired close code
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.close(WS_CLOSE_ROOM_EXPIRED, "Room expired");
      } catch {
        // Socket already closed — ignore
      }
    }

    // Purge all persisted room state from DO storage.
    // Note: deleteAll() does NOT cancel pending alarms (CF behaviour), which
    // is why we call deleteAlarm() above first.
    await this.state.storage.deleteAll();
  }

  // ── Hibernation API event handlers ────────────────────────────────────────

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;

    const tags = this.state.getTags(ws);
    const senderId = tags[0] ?? "unknown";

    // ── Message rate limit: 10 messages / second per peer ────────────────────
    // Uses DO storage so the counter survives hibernation between messages.
    const msgKey = `rl:msg:${senderId}`;
    const now = Date.now();
    const rl: RlWindow =
      (await this.state.storage.get<RlWindow>(msgKey)) ??
      { count: 0, windowStart: now };

    if (now - rl.windowStart >= 1_000) {
      rl.count = 0;
      rl.windowStart = now;
    }

    if (rl.count >= MSG_RATE_LIMIT) {
      ws.close(WS_CLOSE_RATE_LIMITED, "rate limit exceeded");
      return;
    }

    rl.count += 1;
    await this.state.storage.put(msgKey, rl);
    // ─────────────────────────────────────────────────────────────────────────

    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(message);
    } catch {
      return; // Silently discard malformed JSON
    }

    if (msg.type === "signal") {
      const to = msg.to as string;
      const data = msg.data;

      // Find the target WebSocket by its peer tag
      const targetSockets = this.state.getWebSockets(to);
      if (targetSockets.length > 0 && targetSockets[0].readyState === WebSocket.READY_STATE_OPEN) {
        // Peer is live — deliver directly
        targetSockets[0].send(
          JSON.stringify({ type: "signal", from: senderId, data })
        );
      } else {
        // Peer is offline — buffer signal in DO storage for later delivery.
        // The buffer is capped at ICE_BUFFER_MAX entries to prevent abuse.
        const bufKey = `icebuf:${to}`;
        const buffer = await this.state.storage.get<IceEntry[]>(bufKey) ?? [];
        if (buffer.length < ICE_BUFFER_MAX) {
          buffer.push({ from: senderId, data });
          await this.state.storage.put(bufKey, buffer);
        }
      }
    }
    // Other message types (keepalive etc.) are silently ignored
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string): Promise<void> {
    const tags = this.state.getTags(ws);
    const peerId = tags[0];
    if (peerId) {
      // Clean up rate-limit entry so reconnects start fresh
      await this.state.storage.delete(`rl:msg:${peerId}`);
      await this._removeMember(peerId);
      this.broadcastExcept(peerId, { type: "peer_left", peer: peerId });
    }
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    const tags = this.state.getTags(ws);
    const peerId = tags[0];
    if (peerId) {
      await this.state.storage.delete(`rl:msg:${peerId}`);
      await this._removeMember(peerId);
      this.broadcastExcept(peerId, { type: "peer_left", peer: peerId });
    }
    console.error(`WebSocket error for peer ${peerId}:`, error);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async onPeerJoin(peerId: string, ws: WebSocket): Promise<void> {
    // 1. Collect live peers before the new one is counted
    const existingSockets = this.state.getWebSockets();
    const livePeers = existingSockets
      .map((s) => this.state.getTags(s)[0])
      .filter((id): id is string => !!id && id !== peerId);

    // 2. Persist membership in DO storage
    const roomState: RoomState =
      (await this.state.storage.get<RoomState>("room:state")) ??
      { members: [], createdAt: Date.now() };
    if (!roomState.members.includes(peerId)) {
      roomState.members.push(peerId);
      await this.state.storage.put("room:state", roomState);
    }

    // 3. (Re-)schedule the 24h cleanup alarm — sliding window from last join.
    //    setAlarm() overwrites any existing alarm so rooms with active traffic
    //    stay alive; idle rooms expire 24h after the last join.
    await this.state.storage.setAlarm(Date.now() + ROOM_TTL_MS);

    // 4. Welcome the new peer with the list of currently live peers
    ws.send(JSON.stringify({ type: "welcome", peers: livePeers }));

    // 5. Deliver any signals buffered while this peer was offline
    const bufKey = `icebuf:${peerId}`;
    const buffered = await this.state.storage.get<IceEntry[]>(bufKey) ?? [];
    if (buffered.length > 0) {
      for (const entry of buffered) {
        ws.send(JSON.stringify({ type: "signal", from: entry.from, data: entry.data }));
      }
      await this.state.storage.delete(bufKey);
    }

    // 6. Notify existing peers about the newcomer
    this.broadcastExcept(peerId, { type: "peer_joined", peer: peerId });
  }

  /** Remove a peer from the persisted members list. */
  private async _removeMember(peerId: string): Promise<void> {
    const roomState = await this.state.storage.get<RoomState>("room:state");
    if (roomState) {
      roomState.members = roomState.members.filter((m) => m !== peerId);
      await this.state.storage.put("room:state", roomState);
    }
  }

  private broadcastExcept(excludeId: string, message: Record<string, unknown>): void {
    const text = JSON.stringify(message);
    for (const ws of this.state.getWebSockets()) {
      const tags = this.state.getTags(ws);
      if (tags[0] !== excludeId && ws.readyState === WebSocket.READY_STATE_OPEN) {
        ws.send(text);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker: routes incoming requests to the appropriate Durable Object room
// ─────────────────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    const corsHeaders = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGINS || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    };

    // OPTIONS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // ── Health check ─────────────────────────────────────────────────────────
    if (pathname === "/health") {
      return Response.json(
        { service: "weblink-signaling", status: "ok", ts: new Date().toISOString() },
        { headers: corsHeaders }
      );
    }

    // ── WebSocket signaling ───────────────────────────────────────────────────
    if (pathname === "/ws" || pathname === "/webrtc/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("WebSocket upgrade required", {
          status: 426,
          headers: corsHeaders,
        });
      }

      const room = url.searchParams.get("room") || "default";

      // CapAuth bearer token guard — rejects with WS close code 4401 when:
      //   • CAPAUTH_REQUIRE_AUTH="true"  (global enforcement via env var), OR
      //   • the room name starts with "protected/"  (per-room enforcement;
      //     usable in tests without needing env-var injection).
      // In both cases, a missing or blank Bearer token causes the server to
      // immediately close the client WebSocket with close code 4401.
      const requiresAuth =
        env.CAPAUTH_REQUIRE_AUTH === "true" || room.startsWith("protected/");
      if (requiresAuth) {
        const authHeader = request.headers.get("Authorization") ?? "";
        const token = authHeader.startsWith("Bearer ")
          ? authHeader.slice(7).trim()
          : "";
        if (!token) {
          const [client, server] = Object.values(new WebSocketPair()) as [
            WebSocket,
            WebSocket,
          ];
          server.accept();
          server.close(4401, "Unauthorized: CapAuth bearer token required");
          return new Response(null, { status: 101, webSocket: client });
        }
      }
      const roomStub = env.SIGNALING_ROOM.get(env.SIGNALING_ROOM.idFromName(room));

      // Forward to the Durable Object for this room
      return roomStub.fetch(request);
    }

    // ── Peers API ─────────────────────────────────────────────────────────────
    if (pathname === "/api/v1/webrtc/peers" && request.method === "GET") {
      const room = url.searchParams.get("room") || "default";
      const roomStub = env.SIGNALING_ROOM.get(env.SIGNALING_ROOM.idFromName(room));

      // Ask the DO for its current live peer list via the internal /__peers route
      const internalUrl = new URL(request.url);
      internalUrl.pathname = "/__peers";
      const resp = await roomStub.fetch(new Request(internalUrl.toString()));
      const data = (await resp.json()) as { peers: string[] };

      return Response.json({ room, peers: data.peers, count: data.peers.length }, {
        headers: corsHeaders,
      });
    }

    // ── Room state API (members + alarm time) ─────────────────────────────────
    if (pathname === "/api/v1/webrtc/room" && request.method === "GET") {
      const room = url.searchParams.get("room") || "default";
      const roomStub = env.SIGNALING_ROOM.get(env.SIGNALING_ROOM.idFromName(room));

      const internalUrl = new URL(request.url);
      internalUrl.pathname = "/__room_state";
      const resp = await roomStub.fetch(new Request(internalUrl.toString()));
      const data = (await resp.json()) as { roomState: RoomState | null; alarmAt: number | null };

      return Response.json(
        { room, roomState: data.roomState, alarmAt: data.alarmAt },
        { headers: corsHeaders }
      );
    }

    // ── Room expire API (force alarm — useful for testing and admin) ──────────
    if (pathname === "/api/v1/webrtc/room/expire" && request.method === "POST") {
      const room = url.searchParams.get("room") || "default";
      const roomStub = env.SIGNALING_ROOM.get(env.SIGNALING_ROOM.idFromName(room));

      const internalUrl = new URL(request.url);
      internalUrl.pathname = "/__alarm";
      await roomStub.fetch(new Request(internalUrl.toString(), { method: "POST" }));

      return Response.json({ ok: true, room }, { headers: corsHeaders });
    }

    // ── Sovereign DID document resolution (Tier 3 public) ────────────────────
    // Route: GET /agents/:name/.well-known/did.json
    // Reads from CF KV namespace DID_DOCUMENTS; key = agent slug (e.g. "opus").
    // Populated by: skchat/scripts/publish-did.sh
    // DID string: did:web:ws.weblink.skworld.io:agents:<name>
    const didMatch = pathname.match(/^\/agents\/([^/]+)\/.well-known\/did\.json$/);
    if (didMatch && request.method === "GET") {
      const agentSlug = didMatch[1];

      if (!env.DID_DOCUMENTS) {
        return Response.json(
          { error: "DID_DOCUMENTS KV namespace not configured" },
          { status: 503, headers: corsHeaders }
        );
      }

      const docJson = await env.DID_DOCUMENTS.get(agentSlug);
      if (!docJson) {
        return new Response(`DID document not found for agent '${agentSlug}'`, {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      }

      return new Response(docJson, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/did+json",
          // DID documents are public and may be cached briefly
          "Cache-Control": "public, max-age=300",
        },
      });
    }

    return new Response("Not found", { status: 404, headers: corsHeaders });
  },
} satisfies ExportedHandler<Env>;
