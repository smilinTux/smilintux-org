/**
 * Ed25519 operations using Web Crypto API.
 * Works in both browser and Edge Runtime (Vercel).
 */

const ED25519_MULTICODEC = new Uint8Array([0xed, 0x01]);

export async function generateKeypair(): Promise<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeyRaw: Uint8Array;
  didKey: string;
  publicKeyB64: string;
}> {
  const keyPair = await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ]);

  const publicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", keyPair.publicKey)
  );
  const didKey = publicKeyToDid(publicKeyRaw);
  const publicKeyB64 = uint8ToBase64(publicKeyRaw);

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    publicKeyRaw,
    didKey,
    publicKeyB64,
  };
}

export function publicKeyToDid(publicKey: Uint8Array): string {
  const multicodecKey = new Uint8Array(
    ED25519_MULTICODEC.length + publicKey.length
  );
  multicodecKey.set(ED25519_MULTICODEC);
  multicodecKey.set(publicKey, ED25519_MULTICODEC.length);
  return `did:key:z${base58Encode(multicodecKey)}`;
}

export function didToPublicKey(didKey: string): Uint8Array {
  if (!didKey.startsWith("did:key:z")) {
    throw new Error(`Invalid did:key format: ${didKey}`);
  }
  const decoded = base58Decode(didKey.slice("did:key:z".length));
  if (
    decoded[0] !== ED25519_MULTICODEC[0] ||
    decoded[1] !== ED25519_MULTICODEC[1]
  ) {
    throw new Error("Not an Ed25519 did:key");
  }
  return decoded.slice(ED25519_MULTICODEC.length);
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return new Uint8Array(data).buffer as ArrayBuffer;
}

export async function signMessage(
  message: Uint8Array,
  privateKey: CryptoKey
): Promise<Uint8Array> {
  const sig = await crypto.subtle.sign("Ed25519", privateKey, toArrayBuffer(message));
  return new Uint8Array(sig);
}

export async function verifySignature(
  message: Uint8Array,
  signature: Uint8Array,
  publicKeyRaw: Uint8Array
): Promise<boolean> {
  const publicKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(publicKeyRaw),
    "Ed25519",
    false,
    ["verify"]
  );
  return crypto.subtle.verify(
    "Ed25519",
    publicKey,
    toArrayBuffer(signature),
    toArrayBuffer(message)
  );
}

export function voteSigningPayload(
  proposalId: string,
  voterDid: string,
  choice: string,
  priority: number,
  version: number
): Uint8Array {
  const text = `skarchitect:vote:${proposalId}:${voterDid}:${choice}:${priority}:${version}`;
  return new TextEncoder().encode(text);
}

// --- Base58 (Bitcoin alphabet) ---

const B58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(data: Uint8Array): string {
  let n = BigInt(0);
  for (const byte of data) {
    n = n * 256n + BigInt(byte);
  }
  let result = "";
  while (n > 0n) {
    const [q, r] = [n / 58n, n % 58n];
    result = B58_ALPHABET[Number(r)] + result;
    n = q;
  }
  for (const byte of data) {
    if (byte === 0) result = "1" + result;
    else break;
  }
  return result || "1";
}

function base58Decode(s: string): Uint8Array {
  let n = BigInt(0);
  for (const char of s) {
    n = n * 58n + BigInt(B58_ALPHABET.indexOf(char));
  }
  const hex = n.toString(16).padStart(2, "0");
  const bytes = hex.match(/.{2}/g)?.map((b) => parseInt(b, 16)) || [];
  let pad = 0;
  for (const char of s) {
    if (char === "1") pad++;
    else break;
  }
  return new Uint8Array([...new Array(pad).fill(0), ...bytes]);
}

// --- Helpers ---

export function uint8ToBase64(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data));
}

export function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  return new Uint8Array([...binary].map((c) => c.charCodeAt(0)));
}
