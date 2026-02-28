# weblink-signaling — Sovereign WebRTC Signaling Relay

A Cloudflare Worker + Durable Objects WebSocket signaling relay, compatible with the
[Weblink](https://github.com/99percentpeople/weblink) wire protocol and the SKComm
WebRTC transport signaling format.

Deployed at: `wss://ws.weblink.skworld.io`

---

## Architecture

```
Browser / SKComm WebRTC Transport
        │ wss://ws.weblink.skworld.io/webrtc/ws?room=R&peer=FP
        ▼
Cloudflare Worker  (cloudflare/worker.ts)
        │ routes by room name → Durable Object ID
        ▼
SignalingRoom Durable Object  (one per room)
        │ Hibernation API — persists WebSocket state across evictions
        │ webSocketMessage() — relays "signal" type to target peer
        │ webSocketClose() / webSocketError() — broadcasts "peer_left"
        │ onPeerJoin() — sends "welcome" + broadcasts "peer_joined"
        ▼
Peers connected to same room receive relayed SDP/ICE messages
```

**No media passes through the relay** — only SDP offer/answer and ICE candidates.
After the signaling handshake, WebRTC peers connect directly (P2P) or via coturn TURN.

---

## Wire Protocol

Compatible with the Weblink signaling wire protocol:

```json
// Server → Client on connect
{"type": "welcome", "peers": ["<fingerprint_or_peer_id>", ...]}

// Server → Client when another peer joins
{"type": "peer_joined", "peer": "<peer_id>"}

// Client → Server to relay to a specific peer
{"type": "signal", "to": "<peer_id>",
 "data": {
   "sdp": {"type": "offer", "sdp": "v=0\r\n..."},
   "capauth": {
     "fingerprint": "CCBE9306410CF8CD5E393D6DEC31663B95230684",
     "signed_at": "2026-02-28T12:34:56Z",
     "signature": "<base64-pgp-sig-over-sdp+signed_at>"
   }
 }}

// Server → Client relayed signal
{"type": "signal", "from": "<peer_id>", "data": {...}}

// Server → Client when a peer disconnects
{"type": "peer_left", "peer": "<peer_id>"}
```

The `capauth` field in signal messages carries a PGP signature over the SDP body.
Receivers MUST verify this signature before calling `setRemoteDescription()`.
The `signed_at` timestamp prevents replay attacks (reject if older than 5 minutes).

---

## Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check — returns `{"status":"ok"}` |
| `WS /ws?room=R&peer=P` | Weblink-compatible signaling (no auth) |
| `WS /webrtc/ws?room=R&peer=P` | SKComm-compatible signaling (CapAuth auth) |
| `GET /api/v1/webrtc/peers` | List connected peers per room |

Both WebSocket endpoints implement the same wire protocol. The `/webrtc/ws` path
passes `Authorization: Bearer <token>` from SKComm's CapAuth token.

---

## Deploy to Cloudflare Workers

**Prerequisites**: [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

**1. Install dependencies:**
```bash
cd weblink-signaling
npm install -g wrangler
```

**2. Authenticate:**
```bash
wrangler login
```

**3. Set your Cloudflare account ID in `wrangler.toml`:**
```toml
account_id = "your-account-id"  # from Cloudflare dashboard
```

**4. Deploy to production:**
```bash
wrangler deploy --env production
```

**5. Add a custom domain route** (after first deploy):

In `wrangler.toml`, uncomment and configure:
```toml
[[routes]]
pattern = "ws.weblink.skworld.io/*"
zone_name = "skworld.io"
```

Then redeploy.

**6. Verify:**
```bash
curl https://ws.weblink.skworld.io/health
# → {"status":"ok","timestamp":"..."}
```

---

## Local Development (Tailscale Funnel — no VPS needed)

The `weblink-ws-server` Node.js package implements the same protocol locally.
Tailscale Funnel can expose it over HTTPS/WSS (TCP only — works perfectly for WebSocket):

```bash
# Terminal 1: run weblink-ws-server locally (port 8080)
npx weblink-ws-server
# or: bunx weblink-ws-server

# Terminal 2: expose via Tailscale Funnel
tailscale funnel --bg 8080
# → publishes at https://HOSTNAME.tailscale.net
#   WSS: wss://HOSTNAME.tailscale.net/ws
```

Configure SKComm to use this signaling URL:
```yaml
transports:
  webrtc:
    settings:
      signaling_url: "wss://HOSTNAME.tailscale.net/ws"
```

**Note**: Tailscale Funnel is TCP/HTTPS only (no UDP). This works perfectly for
WebSocket signaling. It does NOT work for coturn TURN (which needs UDP port 3478).
Use the coturn server in `skstacks/coturn/` for TURN relay.

---

## ALLOWED_ORIGINS

Production deployment restricts WebSocket connections to sovereign domains:

```toml
[env.production]
vars = { ALLOWED_ORIGINS = "https://skworld.io,https://skchat.skworld.io,https://weblink.skworld.io" }
```

Development allows all origins:
```toml
[env.dev]
vars = { ALLOWED_ORIGINS = "*" }
```

---

## Integration with SKComm

The SKComm WebRTC transport (`skcomm.transports.webrtc`) connects to this signaling
server to negotiate P2P data channels. Configure:

```yaml
# ~/.skcomm/config.yml
transports:
  webrtc:
    enabled: true
    priority: 1
    settings:
      signaling_url: "wss://ws.weblink.skworld.io/webrtc/ws"
      # or: wss://skcomm.skworld.io/webrtc/ws  (SKComm serve broker)
      turn_server: "turn:turn.skworld.io:3478"
      turn_secret: "${SKCOMM_TURN_SECRET}"
```

The `skcomm serve` API server also includes an equivalent in-process signaling broker
at `WS /webrtc/ws` — use either this Cloudflare Worker (edge, always-on, free tier)
or the in-process broker (same machine, lower latency for local agents).

---

## License

MIT — Compatible with [Weblink](https://github.com/99percentpeople/weblink) (MIT).
Part of the [smilinTux](https://github.com/smilinTux) sovereign stack.
