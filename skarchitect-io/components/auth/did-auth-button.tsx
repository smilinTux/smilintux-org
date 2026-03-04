"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  generateKeypair,
  publicKeyToDid,
  signMessage,
  uint8ToBase64,
} from "@/lib/crypto/ed25519";

interface StoredIdentity {
  didKey: string;
  publicKeyB64: string;
}

export function DIDAuthButton() {
  const [session, setSession] = useState<{
    did_key: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check existing session
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.did_key) setSession({ did_key: data.did_key });
      })
      .catch(() => {});
  }, []);

  async function handleSignIn() {
    setLoading(true);
    try {
      // Generate or retrieve keypair
      const kp = await generateKeypair();

      // Store keys in IndexedDB for persistence
      await storeKeys(kp.privateKey, kp.publicKey, kp.didKey, kp.publicKeyB64);

      // Get challenge from server
      const challengeRes = await fetch("/api/auth/challenge", {
        method: "POST",
      });
      const { challenge } = await challengeRes.json();

      // Sign challenge
      const message = new TextEncoder().encode(
        `skarchitect:auth:${challenge}`
      );
      const signature = await signMessage(message, kp.privateKey);
      const signatureB64 = uint8ToBase64(signature);

      // Verify with server
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          did_key: kp.didKey,
          challenge,
          signature: signatureB64,
          public_key_b64: kp.publicKeyB64,
          entity_type: "human",
        }),
      });

      if (verifyRes.ok) {
        const data = await verifyRes.json();
        setSession({ did_key: data.did_key });
      }
    } catch (err) {
      console.error("Auth failed:", err);
    } finally {
      setLoading(false);
    }
  }

  if (session) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-emerald-400">
          {session.did_key.slice(0, 16)}...
        </span>
      </div>
    );
  }

  return (
    <Button
      onClick={handleSignIn}
      disabled={loading}
      variant="outline"
      className="border-emerald-600 text-emerald-400 hover:bg-emerald-600/10"
    >
      {loading ? "Signing in..." : "Sign In with DID"}
    </Button>
  );
}

// --- IndexedDB helpers ---

async function storeKeys(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
  didKey: string,
  publicKeyB64: string
) {
  const db = await openDB();
  const tx = db.transaction("keys", "readwrite");
  const store = tx.objectStore("keys");
  store.put({
    id: "sovereign-identity",
    privateKey,
    publicKey,
    didKey,
    publicKeyB64,
  });
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("skarchitect", 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("keys", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
