// Audio Steganography Engine (LSB on WAV PCM samples)

// Helper to write ASCII strings to DataView
function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Parse WAV file format
export function parseWav(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  
  // Verify RIFF
  const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (riff !== 'RIFF') throw new Error('Not a valid WAV file (missing RIFF)');
  
  // Verify WAVE
  const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
  if (wave !== 'WAVE') throw new Error('Not a valid WAV file (missing WAVE)');
  
  let offset = 12;
  let fmtInfo = null;
  let dataOffset = null;
  let dataSize = 0;
  
  while (offset < arrayBuffer.byteLength) {
    if (offset + 8 > arrayBuffer.byteLength) break;
    const chunkId = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
    const chunkSize = view.getUint32(offset + 4, true); // little-endian
    
    if (chunkId === 'fmt ') {
      const audioFormat = view.getUint16(offset + 8, true);
      const numChannels = view.getUint16(offset + 10, true);
      const sampleRate = view.getUint32(offset + 12, true);
      const bitsPerSample = view.getUint16(offset + 22, true);
      fmtInfo = { audioFormat, numChannels, sampleRate, bitsPerSample };
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }
    
    offset += 8 + chunkSize;
  }
  
  if (!fmtInfo) throw new Error('WAV missing fmt chunk');
  if (!dataOffset) throw new Error('WAV missing data chunk');
  
  return {
    fmtInfo,
    dataOffset,
    dataSize,
    header: new Uint8Array(arrayBuffer, 0, dataOffset),
    dataBytes: new Uint8Array(arrayBuffer, dataOffset, dataSize),
    trailingBytes: new Uint8Array(arrayBuffer, dataOffset + dataSize)
  };
}

// Encode AudioBuffer to 16-bit PCM WAV ArrayBuffer
export function encodeAudioBufferToWav(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const result = new Float32Array(audioBuffer.length * numChannels);
  
  if (numChannels === 2) {
    const ch0 = audioBuffer.getChannelData(0);
    const ch1 = audioBuffer.getChannelData(1);
    for (let i = 0; i < audioBuffer.length; i++) {
      result[i * 2] = ch0[i];
      result[i * 2 + 1] = ch1[i];
    }
  } else {
    const ch0 = audioBuffer.getChannelData(0);
    result.set(ch0);
  }
  
  const buffer = new ArrayBuffer(44 + result.length * 2);
  const view = new DataView(buffer);
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + result.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, result.length * 2, true);
  
  let offset = 44;
  for (let i = 0; i < result.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, result[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  
  return buffer;
}

// Low-level WAV LSB encoder
export function encodeWavStego(arrayBuffer, payload) {
  const parsed = parseWav(arrayBuffer);
  const { fmtInfo, dataOffset, dataSize, header, dataBytes, trailingBytes } = parsed;
  const bitsPerSample = fmtInfo.bitsPerSample;
  const bytesPerSample = bitsPerSample / 8;
  const numSamples = Math.floor(dataSize / bytesPerSample);
  
  const requiredBits = 32 + payload.length * 8;
  if (numSamples < requiredBits) {
    throw new Error(`Audio file too short. Capacity is ${Math.floor(numSamples / 8) - 4} bytes, message requires ${payload.length} bytes.`);
  }
  
  const modifiedDataBytes = new Uint8Array(dataBytes);
  const view = new DataView(modifiedDataBytes.buffer, modifiedDataBytes.byteOffset, modifiedDataBytes.byteLength);
  
  const writeBit = (sampleIdx, bitVal) => {
    const byteOffset = sampleIdx * bytesPerSample;
    if (bitsPerSample === 16) {
      let val = view.getInt16(byteOffset, true);
      val = (val & ~1) | bitVal;
      view.setInt16(byteOffset, val, true);
    } else if (bitsPerSample === 8) {
      let val = view.getUint8(byteOffset);
      val = (val & ~1) | bitVal;
      view.setUint8(byteOffset, val);
    } else if (bitsPerSample === 24 || bitsPerSample === 32) {
      let val = view.getUint8(byteOffset);
      val = (val & ~1) | bitVal;
      view.setUint8(byteOffset, val);
    }
  };
  
  // 1. Write payload length (32 bits, big-endian)
  const len = payload.length;
  for (let i = 0; i < 32; i++) {
    const bitVal = (len >> (31 - i)) & 1;
    writeBit(i, bitVal);
  }
  
  // 2. Write payload bytes
  let bitOffset = 32;
  for (let i = 0; i < len; i++) {
    const byteVal = payload[i];
    for (let bit = 7; bit >= 0; bit--) {
      const bitVal = (byteVal >> bit) & 1;
      writeBit(bitOffset, bitVal);
      bitOffset++;
    }
  }
  
  const outputBuffer = new Uint8Array(header.length + modifiedDataBytes.length + trailingBytes.length);
  outputBuffer.set(header, 0);
  outputBuffer.set(modifiedDataBytes, header.length);
  outputBuffer.set(trailingBytes, header.length + modifiedDataBytes.length);
  
  return outputBuffer.buffer;
}

// Low-level WAV LSB decoder
export function decodeWavStego(arrayBuffer) {
  let parsed;
  try {
    parsed = parseWav(arrayBuffer);
  } catch (e) {
    // If not a valid WAV file (missing RIFF etc.), return null
    return null;
  }
  
  const { fmtInfo, dataSize, dataBytes } = parsed;
  const bitsPerSample = fmtInfo.bitsPerSample;
  const bytesPerSample = bitsPerSample / 8;
  const numSamples = Math.floor(dataSize / bytesPerSample);
  
  if (numSamples < 32) return null;
  
  const view = new DataView(dataBytes.buffer, dataBytes.byteOffset, dataBytes.byteLength);
  
  const readBit = (sampleIdx) => {
    const byteOffset = sampleIdx * bytesPerSample;
    if (bitsPerSample === 16) {
      const val = view.getInt16(byteOffset, true);
      return val & 1;
    } else if (bitsPerSample === 8) {
      const val = view.getUint8(byteOffset);
      return val & 1;
    } else if (bitsPerSample === 24 || bitsPerSample === 32) {
      const val = view.getUint8(byteOffset);
      return val & 1;
    }
    return 0;
  };
  
  // 1. Read payload length
  let len = 0;
  for (let i = 0; i < 32; i++) {
    const bitVal = readBit(i);
    len = (len << 1) | bitVal;
  }
  
  const requiredSamples = 32 + len * 8;
  if (len <= 0 || numSamples < requiredSamples) {
    return null; // Invalid length or size mismatch
  }
  
  // 2. Read payload bytes
  const payload = new Uint8Array(len);
  let bitOffset = 32;
  for (let i = 0; i < len; i++) {
    let byteVal = 0;
    for (let bit = 7; bit >= 0; bit--) {
      const bitVal = readBit(bitOffset);
      byteVal = (byteVal << 1) | bitVal;
      bitOffset++;
    }
    payload[i] = byteVal;
  }
  
  return payload;
}

// Decode compressed formats (like MP3) to AudioBuffer
async function decodeAudioFileToBuffer(file) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuffer = await file.arrayBuffer();
  // decodeAudioData consumes the buffer, so we pass a clone if needed, but here it's fine
  return await audioCtx.decodeAudioData(arrayBuffer);
}

// Main entrypoint for encoding audio
export async function encodeAudio(file, payload) {
  const ext = file.name.split('.').pop().toLowerCase();
  
  if (ext === 'wav') {
    const arrayBuffer = await file.arrayBuffer();
    const encodedWavBuffer = encodeWavStego(arrayBuffer, payload);
    return new Blob([encodedWavBuffer], { type: 'audio/wav' });
  } else {
    // MP3 or other compressed format:
    // 1. Decode to PCM AudioBuffer
    const audioBuffer = await decodeAudioFileToBuffer(file);
    // 2. Encode AudioBuffer to WAV ArrayBuffer
    const wavBuffer = encodeAudioBufferToWav(audioBuffer);
    // 3. Encode our stego payload into WAV
    const encodedWavBuffer = encodeWavStego(wavBuffer, payload);
    // Return WAV as Blob (with original name, but WAV structure)
    return new Blob([encodedWavBuffer], { type: 'audio/wav' });
  }
}

// Main entrypoint for decoding audio
export async function decodeAudio(file) {
  const arrayBuffer = await file.arrayBuffer();
  // Try to decode WAV stego
  return decodeWavStego(arrayBuffer);
}
