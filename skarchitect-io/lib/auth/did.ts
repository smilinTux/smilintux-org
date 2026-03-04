/**
 * DID:key utilities for server-side verification.
 */

import {
  didToPublicKey,
  verifySignature,
  base64ToUint8,
} from "@/lib/crypto/ed25519";

export async function verifyDIDSignature(
  didKey: string,
  message: Uint8Array,
  signatureB64: string
): Promise<boolean> {
  const publicKey = didToPublicKey(didKey);
  const signature = base64ToUint8(signatureB64);
  return verifySignature(message, signature, publicKey);
}
