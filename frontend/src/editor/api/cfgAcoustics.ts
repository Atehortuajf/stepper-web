export const DECODER_ACOUSTIC_DIM = 256;

export interface DecoderAcousticBuffers {
  conditioned: Float32Array;
  nullConditioned: Float32Array;
}

/** Slice aligned conditioned and null-conditioned placement features for one decoder window. */
export function prepareDecoderAcousticBuffers(
  acousticMap: Float32Array,
  nullAcousticMap: Float32Array,
  placedTicks: number[],
  chunkStart: number,
  chunkSize: number,
  maxLength: number,
): DecoderAcousticBuffers {
  const conditioned = new Float32Array(maxLength * DECODER_ACOUSTIC_DIM);
  const nullConditioned = new Float32Array(maxLength * DECODER_ACOUSTIC_DIM);

  for (let index = 0; index < chunkSize; index++) {
    const tick = placedTicks[chunkStart + index];
    const sourceStart = tick * DECODER_ACOUSTIC_DIM;
    const sourceEnd = sourceStart + DECODER_ACOUSTIC_DIM;
    const destinationStart = index * DECODER_ACOUSTIC_DIM;
    conditioned.set(acousticMap.subarray(sourceStart, sourceEnd), destinationStart);
    nullConditioned.set(nullAcousticMap.subarray(sourceStart, sourceEnd), destinationStart);
  }

  return { conditioned, nullConditioned };
}
