/**
 * Mock CapAuth server for E2E tests.
 *
 * Implements the CapAuth v1 challenge-response protocol endpoints:
 *   POST /capauth/v1/challenge   → returns nonce challenge
 *   POST /capauth/v1/verify      → returns JWT token
 *   GET  /capauth/v1/status      → returns server status
 *
 * The mock server accepts any valid-structure request and returns
 * successful responses. It records all calls for assertion in tests.
 */

import http from 'http';
import crypto from 'crypto';

/**
 * Generate a random UUID-like nonce.
 *
 * @returns {string}
 */
function generateNonce() {
  return crypto.randomUUID();
}

/**
 * Generate a mock JWT token (not cryptographically valid — for testing only).
 *
 * @param {string} fingerprint
 * @returns {string}
 */
function generateMockJwt(fingerprint) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: fingerprint,
    iss: 'mock-capauth',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    email: `${fingerprint.slice(0, 8).toLowerCase()}@test.skworld.io`,
    fingerprint,
  })).toString('base64url');
  const sig = Buffer.from('mock-signature').toString('base64url');
  return `${header}.${payload}.${sig}`;
}

/**
 * Create and return a mock CapAuth server.
 *
 * @param {Object} [opts={}]
 * @param {boolean} [opts.rejectVerify=false] - Make /verify return 401
 * @param {boolean} [opts.rejectChallenge=false] - Make /challenge return 400
 */
export function createMockCapAuthServer(opts = {}) {
  const calls = [];
  let { rejectVerify = false, rejectChallenge = false } = opts;
  // Pending challenges keyed by nonce
  const challenges = new Map();

  const server = http.createServer((req, res) => {
    const bodyChunks = [];
    req.on('data', (chunk) => bodyChunks.push(chunk));
    req.on('end', () => {
      const rawBody = Buffer.concat(bodyChunks).toString('utf8');
      let body = null;
      try { body = JSON.parse(rawBody); } catch { /* not JSON */ }

      calls.push({ method: req.method, url: req.url, body });

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = req.url.split('?')[0];

      if (req.method === 'GET' && url === '/capauth/v1/status') {
        res.writeHead(200);
        res.end(JSON.stringify({ status: 'ok', version: '1.0', mock: true }));

      } else if (req.method === 'POST' && url === '/capauth/v1/challenge') {
        if (rejectChallenge) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid request', code: 'INVALID_FINGERPRINT' }));
          return;
        }

        const { fingerprint, client_nonce } = body ?? {};
        const nonce = generateNonce();
        const expires = new Date(Date.now() + 60_000).toISOString();

        challenges.set(nonce, { fingerprint, client_nonce, created: Date.now() });

        res.writeHead(200);
        res.end(JSON.stringify({
          nonce,
          client_nonce_echo: client_nonce,
          timestamp: new Date().toISOString(),
          service: body?.requested_service ?? 'mock-service',
          expires,
          capauth_version: '1.0',
        }));

      } else if (req.method === 'POST' && url === '/capauth/v1/verify') {
        if (rejectVerify) {
          res.writeHead(401);
          res.end(JSON.stringify({
            error: 'Signature verification failed',
            code: 'INVALID_SIGNATURE',
          }));
          return;
        }

        const { fingerprint, nonce } = body ?? {};
        const accessToken = generateMockJwt(fingerprint ?? 'unknown');

        res.writeHead(200);
        res.end(JSON.stringify({
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: 3600,
          oidc_claims: {
            sub: fingerprint ?? 'unknown',
            email: `${(fingerprint ?? 'test').slice(0, 8).toLowerCase()}@test.skworld.io`,
            name: 'Test User',
            fingerprint: fingerprint ?? 'unknown',
          },
          nonce_used: nonce,
        }));

      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: `Not found: ${req.method} ${url}` }));
      }
    });
  });

  return {
    server,
    calls,
    challenges,

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
      challenges.clear();
      rejectVerify = false;
      rejectChallenge = false;
    },

    /** Make /verify return 401 for this server instance */
    setRejectVerify(val) { rejectVerify = val; },
    setRejectChallenge(val) { rejectChallenge = val; },

    callsTo(method, urlPrefix) {
      return calls.filter((c) => c.method === method && c.url.startsWith(urlPrefix));
    },
  };
}
