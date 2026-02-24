import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "./db";

interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (base64.length % 4)) % 4;
  const padded = base64 + "=".repeat(pad);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function uint8ArrayToBase64url(buf: Uint8Array): string {
  let binary = "";
  for (const byte of buf) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function toBuffer(arr: Uint8Array): ArrayBuffer {
  return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
}

function concatBuffers(...bufs: Uint8Array[]): Uint8Array {
  const total = bufs.reduce((n, b) => n + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const buf of bufs) {
    result.set(buf, offset);
    offset += buf.length;
  }
  return result;
}

async function createVapidAuthHeader(
  endpoint: string,
  vapidPrivateKeyJwk: JsonWebKey,
  vapidPublicKey: string,
  vapidSubject: string
): Promise<{ authorization: string }> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: vapidSubject,
  };

  const encoder = new TextEncoder();
  const headerB64 = uint8ArrayToBase64url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64url(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    "jwk",
    vapidPrivateKeyJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    key,
    encoder.encode(unsignedToken)
  );

  // Convert DER signature to raw r||s (64 bytes)
  const sigBytes = new Uint8Array(signature);
  let rawSig: Uint8Array;
  if (sigBytes.length === 64) {
    rawSig = sigBytes;
  } else {
    // Web Crypto on some platforms returns raw r||s, others DER
    rawSig = sigBytes;
  }

  const jwt = `${unsignedToken}.${uint8ArrayToBase64url(rawSig)}`;

  return {
    authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
  };
}

// Encrypt payload using aes128gcm (RFC 8291 + RFC 8188)
async function encryptPayload(
  subscription: PushSubscription,
  payloadBytes: Uint8Array
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const userPublicKeyBytes = base64urlToUint8Array(subscription.p256dh);
  const authSecret = base64urlToUint8Array(subscription.auth);

  // Generate local ephemeral key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const localPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeyPair.publicKey)
  );

  // Import user's public key
  const userPublicKey = await crypto.subtle.importKey(
    "raw",
    toBuffer(userPublicKeyBytes),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: userPublicKey },
      localKeyPair.privateKey,
      256
    )
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();

  // HKDF to derive auth info
  const authInfo = concatBuffers(
    encoder.encode("WebPush: info\0"),
    userPublicKeyBytes,
    localPublicKeyRaw
  );

  const ikmKey = await crypto.subtle.importKey("raw", toBuffer(sharedSecret), { name: "HKDF" }, false, ["deriveBits"]);

  // PRK = HKDF-Extract(auth_secret, ecdh_secret)
  const prkBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: toBuffer(authSecret), info: toBuffer(authInfo) },
    ikmKey,
    256
  );

  const prkKey = await crypto.subtle.importKey("raw", prkBits, { name: "HKDF" }, false, ["deriveBits"]);

  // Content encryption key
  const cekInfo = encoder.encode("Content-Encoding: aes128gcm\0");
  const cekBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: toBuffer(salt), info: toBuffer(cekInfo) },
    prkKey,
    128
  );

  // Nonce
  const nonceInfo = encoder.encode("Content-Encoding: nonce\0");
  const nonceBits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: toBuffer(salt), info: toBuffer(nonceInfo) },
    prkKey,
    96
  );

  // Encrypt with AES-128-GCM
  const contentKey = await crypto.subtle.importKey(
    "raw",
    cekBits,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  // Add padding delimiter (0x02 for final record)
  const paddedPayload = concatBuffers(payloadBytes, new Uint8Array([2]));

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonceBits },
      contentKey,
      toBuffer(paddedPayload)
    )
  );

  // Build aes128gcm header: salt(16) || rs(4) || idlen(1) || keyid(65) || ciphertext
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  const header = concatBuffers(
    salt,
    rs,
    new Uint8Array([localPublicKeyRaw.length]),
    localPublicKeyRaw
  );

  return {
    ciphertext: concatBuffers(header, encrypted),
    salt,
    localPublicKey: localPublicKeyRaw,
  };
}

export async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushPayload
): Promise<boolean> {
  const env = (getCloudflareContext() as any).env;
  const vapidPublicKey = env.VAPID_PUBLIC_KEY;
  const vapidPrivateKeyJwk = JSON.parse(env.VAPID_PRIVATE_KEY);
  const vapidSubject = env.VAPID_SUBJECT;

  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));

  const { ciphertext } = await encryptPayload(subscription, payloadBytes);
  const { authorization } = await createVapidAuthHeader(
    subscription.endpoint,
    vapidPrivateKeyJwk,
    vapidPublicKey,
    vapidSubject
  );

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "normal",
    },
    body: toBuffer(ciphertext),
  });

  if (response.status === 410 || response.status === 404) {
    // Subscription expired — clean up
    const db = getDb();
    await db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(subscription.endpoint).run();
    return false;
  }

  return response.ok;
}

export async function sendNotificationToUser(
  userId: string,
  payload: PushPayload
): Promise<void> {
  const db = getDb();
  const { results } = await db
    .prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?")
    .bind(userId)
    .all<PushSubscription>();

  await Promise.allSettled(
    results.map((sub) => sendPushNotification(sub, payload))
  );
}
