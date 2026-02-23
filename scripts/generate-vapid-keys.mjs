// Run: node scripts/generate-vapid-keys.mjs
// Generates VAPID key pair for Web Push using Web Crypto API

const keyPair = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"]
);

const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

// URL-safe base64 encode the raw x,y coordinates for the public key
// (uncompressed point: 0x04 || x || y)
function base64urlToBuffer(b64url) {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function bufferToBase64url(buf) {
  let binary = "";
  for (const byte of buf) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const x = base64urlToBuffer(publicJwk.x);
const y = base64urlToBuffer(publicJwk.y);
const uncompressed = new Uint8Array(65);
uncompressed[0] = 0x04;
uncompressed.set(x, 1);
uncompressed.set(y, 33);
const publicKeyBase64url = bufferToBase64url(uncompressed);

console.log("\n=== VAPID Keys ===\n");
console.log("VAPID_PUBLIC_KEY=" + publicKeyBase64url);
console.log("VAPID_PRIVATE_KEY=" + JSON.stringify(privateJwk));
console.log("VAPID_SUBJECT=mailto:feedback@sunken.site");
console.log("\nAdd these to wrangler.jsonc vars section.\n");
