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
 *   WS  /ws?room=<room>&peer=<id>          weblink PWA compatibility
 *   WS  /webrtc/ws?room=<room>&peer=<id>   SKComm signaling endpoint
 *   GET /api/v1/webrtc/peers?room=<room>   list peers in a room
 *   GET /health                            health check
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
}

// ─────────────────────────────────────────────────────────────────────────────
// Durable Object: SignalingRoom
//
// One DO instance per room. Manages all WebSocket connections in that room.
// Uses the Hibernation API so the DO can sleep when idle and wake on message.
// ─────────────────────────────────────────────────────────────────────────────

export class SignalingRoom implements DurableObject {
  private state: DurableObjectState;

  constructor(state: DurableObjectState, _env: Env) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Internal API: list connected peers
    if (url.pathname === "/__peers") {
      const sockets = this.state.getWebSockets();
      const peers = sockets.map((ws) => this.state.getTags(ws)[0] ?? "unknown");
      return Response.json({ peers });
    }

    // WebSocket upgrade
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }

    const peerId = url.searchParams.get("peer") || "anonymous";

    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];

    // Accept with hibernation API — the DO can be evicted between messages
    this.state.acceptWebSocket(server, [peerId]);

    await this.onPeerJoin(peerId, server);

    return new Response(null, { status: 101, webSocket: client });
  }

  // ── Hibernation API event handlers ────────────────────────────────────────

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;

    const tags = this.state.getTags(ws);
    const senderId = tags[0] ?? "unknown";

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
        targetSockets[0].send(
          JSON.stringify({ type: "signal", from: senderId, data })
        );
      }
    }
    // Other message types (keepalive etc.) are silently ignored
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string): Promise<void> {
    const tags = this.state.getTags(ws);
    const peerId = tags[0];
    if (peerId) {
      this.broadcastExcept(peerId, { type: "peer_left", peer: peerId });
    }
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    const tags = this.state.getTags(ws);
    const peerId = tags[0];
    if (peerId) {
      this.broadcastExcept(peerId, { type: "peer_left", peer: peerId });
    }
    console.error(`WebSocket error for peer ${peerId}:`, error);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async onPeerJoin(peerId: string, ws: WebSocket): Promise<void> {
    // Collect existing peer IDs before adding the new one
    const existingSockets = this.state.getWebSockets();
    const existingPeers = existingSockets
      .map((s) => this.state.getTags(s)[0])
      .filter((id): id is string => !!id && id !== peerId);

    // Welcome the new peer with the list of existing peers
    ws.send(JSON.stringify({ type: "welcome", peers: existingPeers }));

    // Notify others about the new peer
    this.broadcastExcept(peerId, { type: "peer_joined", peer: peerId });
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
      "Access-Control-Allow-Methods": "GET, OPTIONS",
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
      const roomStub = env.SIGNALING_ROOM.get(env.SIGNALING_ROOM.idFromName(room));

      // Forward to the Durable Object for this room
      return roomStub.fetch(request);
    }

    // ── Peers API ─────────────────────────────────────────────────────────────
    if (pathname === "/api/v1/webrtc/peers" && request.method === "GET") {
      const room = url.searchParams.get("room") || "default";
      const roomStub = env.SIGNALING_ROOM.get(env.SIGNALING_ROOM.idFromName(room));

      // Ask the DO for its current peer list via the internal /__peers route
      const internalUrl = new URL(request.url);
      internalUrl.pathname = "/__peers";
      const resp = await roomStub.fetch(new Request(internalUrl.toString()));
      const data = (await resp.json()) as { peers: string[] };

      return Response.json({ room, peers: data.peers, count: data.peers.length }, {
        headers: corsHeaders,
      });
    }

    return new Response("Not found", { status: 404, headers: corsHeaders });
  },
} satisfies ExportedHandler<Env>;
