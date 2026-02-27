const ALGO = "AES-GCM";
const IV_LENGTH = 12; // bytes

// Cifra un objeto JS → base64(iv || ciphertext)
export async function encryptObject(key, data) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: ALGO, iv }, key, encoded);

  // Concatenar iv + ciphertext en un solo buffer
  const buf = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  buf.set(iv, 0);
  buf.set(new Uint8Array(ciphertext), IV_LENGTH);
  return btoa(String.fromCharCode(...buf));
}

// Descifra base64(iv || ciphertext) → objeto JS original
export async function decryptObject(key, b64) {
  const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const iv = buf.slice(0, IV_LENGTH);
  const ciphertext = buf.slice(IV_LENGTH);
  const decrypted = await crypto.subtle.decrypt({ name: ALGO, iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

// Genera una CryptoKey nueva + su representación base64 para Firestore
export async function generateEmpresaKey() {
  const key = await crypto.subtle.generateKey(
    { name: ALGO, length: 256 },
    true, // extractable para poder exportarla
    ["encrypt", "decrypt"]
  );
  const raw = await crypto.subtle.exportKey("raw", key);
  const rawB64 = btoa(String.fromCharCode(...new Uint8Array(raw)));
  return { key, rawB64 };
}

// Importa una CryptoKey desde su representación base64 (no extractable en uso)
export async function importEmpresaKey(rawB64) {
  const raw = Uint8Array.from(atob(rawB64), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: ALGO },
    false, // no extractable en la sesión
    ["encrypt", "decrypt"]
  );
}
