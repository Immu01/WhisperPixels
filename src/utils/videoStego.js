// Video Steganography Engine (Container-level Appending)

const TAIL_MAGIC = "WSPX_TAIL"; // 9 bytes

export async function encodeVideo(file, payload) {
  const arrayBuffer = await file.arrayBuffer();
  const originalBytes = new Uint8Array(arrayBuffer);
  const payloadLength = payload.length;
  
  // Calculate extra size: payload length + 4 bytes (for length) + TAIL_MAGIC.length
  const extraSize = payloadLength + 4 + TAIL_MAGIC.length;
  const output = new Uint8Array(originalBytes.length + extraSize);
  
  // Copy original file bytes
  output.set(originalBytes, 0);
  
  // Copy payload bytes
  output.set(payload, originalBytes.length);
  
  // Write payload length (4 bytes uint32, big-endian) at the end of the payload
  const view = new DataView(output.buffer, output.byteOffset, output.byteLength);
  const lengthOffset = originalBytes.length + payloadLength;
  view.setUint32(lengthOffset, payloadLength, false);
  
  // Copy tail magic
  const tailBytes = new TextEncoder().encode(TAIL_MAGIC);
  output.set(tailBytes, lengthOffset + 4);
  
  return new Blob([output], { type: file.type || 'video/mp4' });
}

export async function decodeVideo(file) {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const len = bytes.length;
  const tailLen = TAIL_MAGIC.length;
  
  if (len < tailLen + 4) {
    return null;
  }
  
  // Read last tailLen bytes
  const tailBytes = bytes.subarray(len - tailLen);
  const tailStr = new TextDecoder().decode(tailBytes);
  if (tailStr !== TAIL_MAGIC) {
    return null; // Tail magic doesn't match
  }
  
  // Read payload length (4 bytes before tail magic)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const lengthOffset = len - tailLen - 4;
  const payloadLength = view.getUint32(lengthOffset, false);
  
  if (payloadLength <= 0 || payloadLength > lengthOffset) {
    return null; // Invalid payload length
  }
  
  const payloadOffset = lengthOffset - payloadLength;
  const payload = bytes.slice(payloadOffset, lengthOffset);
  
  return payload;
}
