// Utilities for cryptography and serialization

export function stringToBytes(str) {
  return new TextEncoder().encode(str);
}

export function bytesToString(bytes) {
  return new TextDecoder().decode(bytes);
}

// Hash key with SHA-256
export async function hashKey(key) {
  const data = stringToBytes(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

// Symmetric encryption/decryption using XOR keystream from SHA-256 block generator
export async function encryptDecryptMessage(messageBytes, keyString) {
  const keyHash = await hashKey(keyString);
  const encryptedBytes = new Uint8Array(messageBytes.length);
  
  let blockIndex = 0;
  let byteIndex = 0;
  
  while (byteIndex < messageBytes.length) {
    // Create block seed: keyHash + blockIndex (as 4 bytes)
    const blockSeed = new Uint8Array(keyHash.length + 4);
    blockSeed.set(keyHash, 0);
    const view = new DataView(blockSeed.buffer);
    view.setUint32(keyHash.length, blockIndex, false); // big-endian
    
    const blockHashBuffer = await crypto.subtle.digest('SHA-256', blockSeed);
    const blockHash = new Uint8Array(blockHashBuffer);
    
    for (let i = 0; i < 32 && byteIndex < messageBytes.length; i++) {
      encryptedBytes[byteIndex] = messageBytes[byteIndex] ^ blockHash[i];
      byteIndex++;
    }
    blockIndex++;
  }
  return encryptedBytes;
}

// Serialize keyHash, hint, and encrypted message to binary payload
export function serializePayload(keyHash, hint, encryptedMessage) {
  const hintBytes = stringToBytes(hint);
  const totalLength = 4 + 32 + 2 + hintBytes.length + 4 + encryptedMessage.length;
  const payload = new Uint8Array(totalLength);
  
  // Magic bytes "WSPX"
  payload.set(stringToBytes("WSPX"), 0);
  
  // Key Hash (32 bytes)
  payload.set(keyHash, 4);
  
  // Hint Length (2 bytes)
  const view = new DataView(payload.buffer);
  view.setUint16(4 + 32, hintBytes.length, false); // big-endian
  
  // Hint
  payload.set(hintBytes, 4 + 32 + 2);
  
  // Message Length (4 bytes)
  const msgOffset = 4 + 32 + 2 + hintBytes.length;
  view.setUint32(msgOffset, encryptedMessage.length, false); // big-endian
  
  // Message
  payload.set(encryptedMessage, msgOffset + 4);
  
  return payload;
}

// Deserialize binary payload
export function deserializePayload(payloadBytes) {
  if (payloadBytes.length < 4 + 32 + 2 + 4) {
    throw new Error("Payload too short to be valid WhisperPixels data");
  }
  
  // Check magic bytes
  const magic = bytesToString(payloadBytes.subarray(0, 4));
  if (magic !== "WSPX") {
    throw new Error("Invalid payload magic signature");
  }
  
  const keyHash = payloadBytes.slice(4, 36);
  
  const view = new DataView(payloadBytes.buffer, payloadBytes.byteOffset, payloadBytes.byteLength);
  const hintLength = view.getUint16(4 + 32, false);
  
  const hintOffset = 4 + 32 + 2;
  if (payloadBytes.length < hintOffset + hintLength + 4) {
    throw new Error("Payload size mismatch");
  }
  
  const hint = bytesToString(payloadBytes.subarray(hintOffset, hintOffset + hintLength));
  
  const msgOffset = hintOffset + hintLength;
  const msgLength = view.getUint32(msgOffset, false);
  
  if (payloadBytes.length < msgOffset + 4 + msgLength) {
    throw new Error("Payload message size mismatch");
  }
  
  const encryptedMessage = payloadBytes.slice(msgOffset + 4, msgOffset + 4 + msgLength);
  
  return {
    keyHash,
    hint,
    encryptedMessage
  };
}

// Encode bytes into zero-width characters (wrapped in \u200D)
export function bytesToZeroWidth(bytes) {
  let result = "\u200D"; // Start marker
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    for (let bit = 7; bit >= 0; bit--) {
      const bitVal = (byte >> bit) & 1;
      result += bitVal === 0 ? "\u200B" : "\u200C"; // 200B is 0, 200C is 1
    }
  }
  result += "\u200D"; // End marker
  return result;
}

// Decode zero-width characters back to bytes
export function zeroWidthToBytes(text) {
  const startIdx = text.indexOf("\u200D");
  if (startIdx === -1) return null;
  const endIdx = text.indexOf("\u200D", startIdx + 1);
  if (endIdx === -1) return null;
  
  const zeroWidthStr = text.substring(startIdx + 1, endIdx);
  const bytes = [];
  let currentByte = 0;
  let bitCount = 0;
  
  for (let i = 0; i < zeroWidthStr.length; i++) {
    const char = zeroWidthStr[i];
    if (char === "\u200B") {
      currentByte = (currentByte << 1) | 0;
      bitCount++;
    } else if (char === "\u200C") {
      currentByte = (currentByte << 1) | 1;
      bitCount++;
    }
    
    if (bitCount === 8) {
      bytes.push(currentByte);
      currentByte = 0;
      bitCount = 0;
    }
  }
  
  if (bytes.length === 0) return null;
  return new Uint8Array(bytes);
}
