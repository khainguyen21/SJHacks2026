// This file handles all the military-grade encryption using the native Web Crypto API.

// 1. Convert a password string into a 256-bit AES-GCM CryptoKey using PBKDF2
export async function deriveKey(password: string, saltString: string = "CreatorVaultSalt123"): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(saltString),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false, // Don't allow exporting the key!
    ["encrypt", "decrypt"]
  );
}

// 2. Hash a file to create a digital fingerprint (Proof of Creation)
export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// 3. Encrypt a file
export async function encryptFile(file: File, key: CryptoKey): Promise<{ encryptedBlob: Blob, iv: Uint8Array }> {
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // AES-GCM standard IV length
  const buffer = await file.arrayBuffer();

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    buffer
  );

  return {
    encryptedBlob: new Blob([encryptedBuffer], { type: "application/octet-stream" }),
    iv: iv
  };
}

// 4. Decrypt a file
export async function decryptFile(encryptedBlob: Blob, key: CryptoKey, iv: Uint8Array, originalType: string): Promise<Blob> {
  const buffer = await encryptedBlob.arrayBuffer();

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    buffer
  );

  return new Blob([decryptedBuffer], { type: originalType });
}
