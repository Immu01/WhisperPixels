// Image Steganography Engine (LSB)

export async function encodeImage(file, payload) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data; // RGBA array
          
          const totalPixels = canvas.width * canvas.height;
          // We hide in R, G, B channels (ignoring Alpha)
          const totalChannels = totalPixels * 3;
          const requiredBits = 32 + payload.length * 8;
          
          if (requiredBits > totalChannels) {
            reject(new Error(`Message is too large for this image. Capacity: ${Math.floor(totalChannels / 8)} bytes, needed: ${payload.length + 4} bytes.`));
            return;
          }
          
          // Write payload length (32 bits, big-endian)
          const len = payload.length;
          let bitIdx = 0;
          
          const writeBit = (bitVal) => {
            // Map bitIndex to pixel channel index
            const pixelIdx = Math.floor(bitIdx / 3);
            const channelInPixel = bitIdx % 3; // 0=R, 1=G, 2=B
            const dataIdx = pixelIdx * 4 + channelInPixel;
            
            data[dataIdx] = (data[dataIdx] & ~1) | bitVal;
            bitIdx++;
          };
          
          // 1. Write length
          for (let i = 0; i < 32; i++) {
            const bitVal = (len >> (31 - i)) & 1;
            writeBit(bitVal);
          }
          
          // 2. Write payload bytes
          for (let i = 0; i < len; i++) {
            const byteVal = payload[i];
            for (let bit = 7; bit >= 0; bit--) {
              const bitVal = (byteVal >> bit) & 1;
              writeBit(bitVal);
            }
          }
          
          // Put data back and convert canvas to blob
          ctx.putImageData(imgData, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Failed to export image from canvas"));
            }
          }, "image/png");
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error("Failed to load image file"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

export async function decodeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          
          const totalPixels = canvas.width * canvas.height;
          const totalChannels = totalPixels * 3;
          
          if (totalChannels < 32) {
            resolve(null);
            return;
          }
          
          let bitIdx = 0;
          const readBit = () => {
            const pixelIdx = Math.floor(bitIdx / 3);
            const channelInPixel = bitIdx % 3;
            const dataIdx = pixelIdx * 4 + channelInPixel;
            bitIdx++;
            return data[dataIdx] & 1;
          };
          
          // 1. Read length (32 bits)
          let len = 0;
          for (let i = 0; i < 32; i++) {
            const bitVal = readBit();
            len = (len << 1) | bitVal;
          }
          
          // Basic sanity check
          if (len <= 0 || (32 + len * 8) > totalChannels) {
            resolve(null); // No valid payload
            return;
          }
          
          // 2. Read payload bytes
          const payload = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            let byteVal = 0;
            for (let bit = 7; bit >= 0; bit--) {
              const bitVal = readBit();
              byteVal = (byteVal << 1) | bitVal;
            }
            payload[i] = byteVal;
          }
          
          resolve(payload);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error("Failed to decode image file"));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}
