/**
 * Mock SKComm API server for E2E tests.
 *
 * Implements a subset of the SKComm REST API:
 *   GET    /api/v1/status
 *   POST   /api/v1/consciousness/capture
 *   GET    /api/v1/consciousness/snapshots
 *   GET    /api/v1/consciousness/snapshots/:id
 *   GET    /api/v1/consciousness/snapshots/:id/inject
 *   DELETE /api/v1/consciousness/snapshots/:id
 *   POST   /api/v1/consciousness/export/syncthing
 *
 * All calls are recorded in `server.calls` for assertion in tests.
 */

import http from 'http';

/**
 * Create and return a mock SKComm server.
 *
 * @returns {{
 *   server: http.Server,
 *   calls: Array,
 *   snapshots: Map,
 *   start(): Promise<string>,  // resolves with base URL
 *   stop(): Promise<void>,
 *   reset(): void,
 *   simulateDown(): void,
 *   simulateUp(): void,
 * }}
 */
export function createMockSKCommServer() {
  const calls = [];
  const snapshots = new Map();
  let counter = 0;
  let down = false;

  const server = http.createServer((req, res) => {
    if (down) {
      // Simulate server being unreachable — close connection without response
      req.socket.destroy();
      return;
    }

    const bodyChunks = [];
    req.on('data', (chunk) => bodyChunks.push(chunk));
    req.on('end', () => {
      const rawBody = Buffer.concat(bodyChunks).toString('utf8');
      let body = null;
      try { body = JSON.parse(rawBody); } catch { /* not JSON */ }

      calls.push({ method: req.method, url: req.url, body, headers: req.headers });

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // Route matching
      const url = req.url.split('?')[0];

      if (req.method === 'GET' && url === '/api/v1/status') {
        res.writeHead(200);
        res.end(JSON.stringify({
          status: 'ok',
          version: '1.0.0',
          identity: 'test-agent',
          agent: 'sonnet',
        }));

      } else if (req.method === 'POST' && url === '/api/v1/consciousness/capture') {
        const id = `snap_${String(++counter).padStart(4, '0')}`;
        snapshots.set(id, body);
        res.writeHead(201);
        res.end(JSON.stringify({
          snapshot_id: id,
          source_platform: body?.source_platform ?? 'unknown',
          captured_at: new Date().toISOString(),
        }));

      } else if (req.method === 'GET' && url === '/api/v1/consciousness/snapshots') {
        const list = [...snapshots.entries()].map(([id, snap]) => ({
          snapshot_id: id,
          source_platform: snap?.source_platform ?? 'unknown',
          message_count: snap?.messages?.length ?? 0,
          captured_at: snap?.captured_at ?? new Date().toISOString(),
        }));
        res.writeHead(200);
        res.end(JSON.stringify(list));

      } else if (req.method === 'GET' && url.startsWith('/api/v1/consciousness/snapshots/')) {
        const parts = url.split('/');
        // /api/v1/consciousness/snapshots/:id/inject  OR  /api/v1/consciousness/snapshots/:id
        const injectIndex = parts.indexOf('inject');
        const id = injectIndex !== -1 ? parts[injectIndex - 1] : parts.pop();
        const snap = snapshots.get(id);

        if (injectIndex !== -1) {
          // Injection prompt endpoint
          res.writeHead(snap ? 200 : 404);
          res.end(snap
            ? JSON.stringify({
                snapshot_id: id,
                prompt: `[Injected context from ${snap?.source_platform ?? 'unknown'}]`,
                ai_name: snap?.ai_name ?? 'unknown',
                platform: snap?.source_platform ?? 'unknown',
              })
            : JSON.stringify({ error: 'Snapshot not found' })
          );
        } else if (snap) {
          res.writeHead(200);
          res.end(JSON.stringify(snap));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Snapshot not found' }));
        }

      } else if (req.method === 'DELETE' && url.startsWith('/api/v1/consciousness/snapshots/')) {
        const id = url.split('/').pop();
        const existed = snapshots.delete(id);
        res.writeHead(existed ? 204 : 404);
        res.end(existed ? '' : JSON.stringify({ error: 'Not found' }));

      } else if (req.method === 'POST' && url === '/api/v1/consciousness/export/syncthing') {
        res.writeHead(200);
        res.end(JSON.stringify({ exported: true, path: `/syncthing/${body?.folder ?? 'consciousness-swipe'}` }));

      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: `Not found: ${req.method} ${url}` }));
      }
    });
  });

  return {
    server,
    calls,
    snapshots,

    /** Start listening on a random port; returns the base URL */
    start() {
      return new Promise((resolve, reject) => {
        server.listen(0, '127.0.0.1', () => {
          const { port } = server.address();
          resolve(`http://127.0.0.1:${port}`);
        });
        server.once('error', reject);
      });
    },

    stop() {
      return new Promise((resolve) => server.close(resolve));
    },

    reset() {
      calls.length = 0;
      snapshots.clear();
      counter = 0;
      down = false;
    },

    /** Make the server refuse connections (simulate network down) */
    simulateDown() { down = true; },

    simulateUp() { down = false; },

    /** Return calls filtered by method + URL prefix */
    callsTo(method, urlPrefix) {
      return calls.filter(
        (c) => c.method === method && c.url.startsWith(urlPrefix)
      );
    },
  };
}
