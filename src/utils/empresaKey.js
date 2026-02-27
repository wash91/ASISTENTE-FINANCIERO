import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { generateEmpresaKey, importEmpresaKey } from "./crypto";

const keyCache = new Map(); // empresaId → CryptoKey

export async function getEmpresaKey(empresaId) {
  if (keyCache.has(empresaId)) return keyCache.get(empresaId);

  const ref = doc(db, "empresas", empresaId, "config", "keys");
  const snap = await getDoc(ref);

  let cryptoKey;
  if (snap.exists()) {
    const { keyB64 } = snap.data();
    cryptoKey = await importEmpresaKey(keyB64);
  } else {
    // Primera vez: generar, persistir y cachear
    const { key, rawB64 } = await generateEmpresaKey();
    await setDoc(ref, { keyB64: rawB64, createdAt: serverTimestamp() });
    cryptoKey = key;
  }

  keyCache.set(empresaId, cryptoKey);
  return cryptoKey;
}

// Limpiar caché en logout para evitar que una sesión comparta claves con la siguiente
export function clearKeyCache(empresaId) {
  if (empresaId) {
    keyCache.delete(empresaId);
  } else {
    keyCache.clear();
  }
}
