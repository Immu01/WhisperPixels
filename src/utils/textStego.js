// Text Steganography Engine (Unicode Zero-Width Characters)
import { bytesToZeroWidth, zeroWidthToBytes } from './cryptoHelpers';

export async function encodeText(file, payload) {
  const text = await file.text();
  const zeroWidthSeq = bytesToZeroWidth(payload);
  
  // Append zero-width sequence to text
  const modifiedText = text + zeroWidthSeq;
  
  return new Blob([modifiedText], { type: 'text/plain;charset=utf-8' });
}

export async function decodeText(file) {
  const text = await file.text();
  return zeroWidthToBytes(text);
}
