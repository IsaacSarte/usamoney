// Client-side AES-GCM encryption helpers for the vault.
// The master password never leaves the browser.

const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = {
  encode: (buf: ArrayBuffer | Uint8Array) => {
    const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = "";
    for (const b of arr) s += String.fromCharCode(b);
    return btoa(s);
  },
  decode: (s: string) => {
    const bin = atob(s);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  },
};

export const b64encode = b64.encode;
export const b64decode = b64.decode;

export async function deriveKey(password: string, saltB64: string): Promise<CryptoKey> {
  const salt = b64.decode(saltB64);
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export function randomSaltB64() {
  return b64.encode(crypto.getRandomValues(new Uint8Array(16)));
}

export async function encryptString(key: CryptoKey, plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain));
  return { iv: b64.encode(iv), ciphertext: b64.encode(ct) };
}

export async function decryptString(key: CryptoKey, ivB64: string, ctB64: string) {
  const iv = b64.decode(ivB64);
  const ct = b64.decode(ctB64);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return dec.decode(plain);
}

export const VERIFIER_PLAINTEXT = "lovable-vault-ok";