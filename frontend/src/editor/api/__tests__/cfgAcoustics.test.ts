import { describe, expect, it } from 'vitest';
import {
  DECODER_ACOUSTIC_DIM,
  filterPlacedTicksToSpan,
  prepareDecoderWindowBuffers,
} from '../cfgAcoustics';

describe('rolling decoder window', () => {
  it('keeps conditioned and null acoustics distinct and pads future positions', () => {
    const conditionedMap = new Float32Array(5 * DECODER_ACOUSTIC_DIM);
    const nullMap = new Float32Array(5 * DECODER_ACOUSTIC_DIM);
    for (let tick = 0; tick < 5; tick++) {
      conditionedMap.fill(10 + tick, tick * DECODER_ACOUSTIC_DIM, (tick + 1) * DECODER_ACOUSTIC_DIM);
      nullMap.fill(-10 - tick, tick * DECODER_ACOUSTIC_DIM, (tick + 1) * DECODER_ACOUSTIC_DIM);
    }

    const buffers = prepareDecoderWindowBuffers(
      conditionedMap,
      nullMap,
      [1, 3],
      [7],
      1,
      4,
    );

    expect(buffers.conditioned[0]).toBe(11);
    expect(buffers.nullConditioned[0]).toBe(-11);
    expect(buffers.conditioned[DECODER_ACOUSTIC_DIM]).toBe(13);
    expect(buffers.nullConditioned[DECODER_ACOUSTIC_DIM]).toBe(-13);
    expect(buffers.tokens).toEqual(new BigInt64Array([7n, 0n, 0n, 0n]));
    expect(buffers.conditioned[2 * DECODER_ACOUSTIC_DIM]).toBe(0);
    expect(buffers.nullConditioned[2 * DECODER_ACOUSTIC_DIM]).toBe(0);
  });

  it('keeps only ticks inside an exact fractional half-open span', () => {
    expect(filterPlacedTicksToSpan([0, 11, 12, 47, 48], 0.25)).toEqual([0, 11]);
  });

  it('rolls history and aligned features across steps 63, 64, and 65', () => {
    const placedTicks = Array.from({ length: 66 }, (_, index) => 5 + index * 2 + (index >= 64 ? 1 : 0));
    const chosenTokens = Array.from({ length: 65 }, (_, index) => 10 + index);
    const mapTicks = placedTicks[placedTicks.length - 1] + 1;
    const conditionedMap = new Float32Array(mapTicks * DECODER_ACOUSTIC_DIM);
    const nullMap = new Float32Array(mapTicks * DECODER_ACOUSTIC_DIM);
    for (const tick of placedTicks) {
      conditionedMap.fill(tick, tick * DECODER_ACOUSTIC_DIM, (tick + 1) * DECODER_ACOUSTIC_DIM);
      nullMap.fill(-tick, tick * DECODER_ACOUSTIC_DIM, (tick + 1) * DECODER_ACOUSTIC_DIM);
    }

    for (const [step, expectedStart] of [[63, 0], [64, 1], [65, 2]] as const) {
      const buffers = prepareDecoderWindowBuffers(
        conditionedMap,
        nullMap,
        placedTicks,
        chosenTokens,
        step,
        64,
      );
      const firstTick = placedTicks[expectedStart];
      const currentTick = placedTicks[step];

      expect(buffers.windowStart).toBe(expectedStart);
      expect(buffers.activeIndex).toBe(63);
      expect(buffers.tokens[0]).toBe(BigInt(chosenTokens[expectedStart]));
      expect(buffers.tokens[62]).toBe(BigInt(chosenTokens[step - 1]));
      expect(buffers.tokens[63]).toBe(0n);
      expect(buffers.conditioned[0]).toBe(firstTick);
      expect(buffers.nullConditioned[0]).toBe(-firstTick);
      expect(buffers.conditioned[63 * DECODER_ACOUSTIC_DIM]).toBe(currentTick);
      expect(buffers.nullConditioned[63 * DECODER_ACOUSTIC_DIM]).toBe(-currentTick);
      expect(buffers.deltaBeats[0]).toBeCloseTo(
        (firstTick - (expectedStart > 0 ? placedTicks[expectedStart - 1] : 0)) / 48,
      );
      expect(buffers.deltaBeats[63]).toBeCloseTo((currentTick - placedTicks[step - 1]) / 48);
      expect(buffers.beatPhases[63]).toBe(BigInt(currentTick % 48));
      expect(buffers.measurePhases[63]).toBe(BigInt(Math.floor(currentTick / 48) % 4));
    }
  });
});
