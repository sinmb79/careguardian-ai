export interface EncryptedJsonPayload {
  version: "1";
  salt: string;
  iv: string;
  cipherText: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getCrypto() {
  return globalThis.crypto;
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

function bytesToBase64(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await getCrypto().subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return getCrypto().subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: asArrayBuffer(salt),
      iterations: 100_000,
      hash: "SHA-256"
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptJson<T>(
  payload: T,
  passphrase: string
): Promise<EncryptedJsonPayload> {
  const salt = getCrypto().getRandomValues(new Uint8Array(16));
  const iv = getCrypto().getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const plainText = encoder.encode(JSON.stringify(payload));
  const cipherBuffer = await getCrypto().subtle.encrypt(
    { name: "AES-GCM", iv: asArrayBuffer(iv) },
    key,
    plainText
  );

  return {
    version: "1",
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    cipherText: bytesToBase64(new Uint8Array(cipherBuffer))
  };
}

export async function decryptJson<T>(
  payload: EncryptedJsonPayload,
  passphrase: string
): Promise<T> {
  const salt = base64ToBytes(payload.salt);
  const iv = base64ToBytes(payload.iv);
  const cipherText = base64ToBytes(payload.cipherText);
  const key = await deriveKey(passphrase, salt);
  const plainBuffer = await getCrypto().subtle.decrypt(
    { name: "AES-GCM", iv: asArrayBuffer(iv) },
    key,
    asArrayBuffer(cipherText)
  );

  return JSON.parse(decoder.decode(plainBuffer)) as T;
}
