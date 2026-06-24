const PREFIX = "E2EE_";

function uint8ArrayToBase64(arr) {
  let binString = "";
  for (let i = 0; i < arr.length; i++) {
    binString += String.fromCharCode(arr[i]);
  }
  return btoa(binString);
}

function base64ToUint8Array(base64) {
  const binString = atob(base64);
  const arr = new Uint8Array(binString.length);
  for (let i = 0; i < binString.length; i++) {
    arr[i] = binString.charCodeAt(i);
  }
  return arr;
}

export function getChatKey(chatId) {
  return chatId ? `${chatId}_secure_e2ee_2026` : "default_secure_key";
}

export function encrypt(text, key) {
  if (!text) return "";
  try {
    const encoder = new TextEncoder();
    const textBytes = encoder.encode(text);
    const keyBytes = encoder.encode(key);
    
    const encryptedBytes = new Uint8Array(textBytes.length);
    for (let i = 0; i < textBytes.length; i++) {
      const keyByte = keyBytes[i % keyBytes.length];
      // XOR with rotating key byte
      encryptedBytes[i] = textBytes[i] ^ (keyByte ^ (i % 256));
    }
    return PREFIX + uint8ArrayToBase64(encryptedBytes);
  } catch (err) {
    console.error("Encryption error:", err);
    return text;
  }
}

export function decrypt(ciphertext, key) {
  if (!ciphertext) return "";
  if (typeof ciphertext !== "string" || !ciphertext.startsWith(PREFIX)) {
    return ciphertext;
  }
  try {
    const actualCipher = ciphertext.substring(PREFIX.length);
    const encryptedBytes = base64ToUint8Array(actualCipher);
    const keyBytes = new TextEncoder().encode(key);
    
    const decryptedBytes = new Uint8Array(encryptedBytes.length);
    for (let i = 0; i < encryptedBytes.length; i++) {
      const keyByte = keyBytes[i % keyBytes.length];
      decryptedBytes[i] = encryptedBytes[i] ^ (keyByte ^ (i % 256));
    }
    return new TextDecoder().decode(decryptedBytes);
  } catch (err) {
    return ciphertext;
  }
}
