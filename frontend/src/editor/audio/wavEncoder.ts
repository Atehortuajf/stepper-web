/**
 * frontend/src/editor/audio/wavEncoder.ts
 * Client-side 16-bit PCM WAV encoder.
 * Encodes Float32Array PCM samples or AudioBuffer into standard WAV binary format.
 */

export function encodeWAV(
  channelData: Float32Array[],
  sampleRate: number
): ArrayBuffer {
  const numChannels = channelData.length;
  const numSamples = channelData[0].length;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // Helper to write ASCII strings
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF identifier
  writeString(0, 'RIFF');
  // RIFF chunk length (total size - 8)
  view.setUint32(4, 36 + dataSize, true);
  // RIFF type
  writeString(8, 'WAVE');
  // Format chunk identifier
  writeString(12, 'fmt ');
  // Format chunk length (16 for PCM)
  view.setUint32(16, 16, true);
  // Audio format (1 = PCM)
  view.setUint16(20, 1, true);
  // Number of channels
  view.setUint16(22, numChannels, true);
  // Sample rate
  view.setUint32(24, sampleRate, true);
  // Byte rate (sampleRate * blockAlign)
  view.setUint32(28, byteRate, true);
  // Block align (numChannels * bytesPerSample)
  view.setUint16(32, blockAlign, true);
  // Bits per sample
  view.setUint16(34, 16, true);
  // Data chunk identifier
  writeString(36, 'data');
  // Data chunk length
  view.setUint32(40, dataSize, true);

  // Interleave and quantize 32-bit float to 16-bit signed integer
  let offset = 44;
  for (let s = 0; s < numSamples; s++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][s]));
      const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, int16, true);
      offset += 2;
    }
  }

  return buffer;
}
