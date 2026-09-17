export const DECODER_ACOUSTIC_DIM = 256;

export interface DecoderWindowBuffers {
  windowStart: number;
  activeIndex: number;
  tokens: BigInt64Array;
  conditioned: Float32Array;
  nullConditioned: Float32Array;
  deltaBeats: Float32Array;
  beatPhases: BigInt64Array;
  measurePhases: BigInt64Array;
}

/** Keep placement ticks inside the caller's exact half-open beat span. */
export function filterPlacedTicksToSpan(placedTicks: number[], requestedBeats: number): number[] {
  return placedTicks.filter((tick) => tick / 48 < requestedBeats);
}

/** Build one causal rolling decoder window ending at currentStep. */
export function prepareDecoderWindowBuffers(
  acousticMap: Float32Array,
  nullAcousticMap: Float32Array,
  placedTicks: number[],
  chosenTokens: number[],
  currentStep: number,
  maxLength: number,
): DecoderWindowBuffers {
  if (!Number.isInteger(currentStep) || currentStep < 0 || currentStep >= placedTicks.length) {
    throw new Error(`Decoder step ${currentStep} is outside the placed-event sequence`);
  }
  if (!Number.isInteger(maxLength) || maxLength <= 0) {
    throw new Error('Decoder maxLength must be a positive integer');
  }
  if (chosenTokens.length < currentStep) {
    throw new Error(`Decoder step ${currentStep} is missing generated token history`);
  }

  const windowStart = Math.max(0, currentStep - maxLength + 1);
  const activeIndex = currentStep - windowStart;
  const tokens = new BigInt64Array(maxLength);
  const conditioned = new Float32Array(maxLength * DECODER_ACOUSTIC_DIM);
  const nullConditioned = new Float32Array(maxLength * DECODER_ACOUSTIC_DIM);
  const deltaBeats = new Float32Array(maxLength);
  const beatPhases = new BigInt64Array(maxLength);
  const measurePhases = new BigInt64Array(maxLength);

  for (let globalIndex = windowStart; globalIndex <= currentStep; globalIndex++) {
    const index = globalIndex - windowStart;
    const tick = placedTicks[globalIndex];
    const sourceStart = tick * DECODER_ACOUSTIC_DIM;
    const sourceEnd = sourceStart + DECODER_ACOUSTIC_DIM;
    const destinationStart = index * DECODER_ACOUSTIC_DIM;
    conditioned.set(acousticMap.subarray(sourceStart, sourceEnd), destinationStart);
    nullConditioned.set(nullAcousticMap.subarray(sourceStart, sourceEnd), destinationStart);

    const previousTick = globalIndex > 0 ? placedTicks[globalIndex - 1] : 0;
    deltaBeats[index] = (tick - previousTick) / 48;
    beatPhases[index] = BigInt(tick % 48);
    measurePhases[index] = BigInt(Math.floor(tick / 48) % 4);

    if (globalIndex < currentStep) {
      tokens[index] = BigInt(chosenTokens[globalIndex]);
    }
  }

  return {
    windowStart,
    activeIndex,
    tokens,
    conditioned,
    nullConditioned,
    deltaBeats,
    beatPhases,
    measurePhases,
  };
}
