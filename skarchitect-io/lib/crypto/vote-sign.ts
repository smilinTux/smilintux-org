/**
 * Vote signing utilities for the client side.
 */

import {
  signMessage,
  voteSigningPayload,
  uint8ToBase64,
} from "./ed25519";

export async function signVote(
  proposalId: string,
  voterDid: string,
  choice: string,
  priority: number,
  version: number,
  privateKey: CryptoKey
): Promise<string> {
  const payload = voteSigningPayload(
    proposalId,
    voterDid,
    choice,
    priority,
    version
  );
  const signature = await signMessage(payload, privateKey);
  return uint8ToBase64(signature);
}
