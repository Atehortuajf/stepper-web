import { describe, expect, it } from 'vitest';
import {
  DECODER_ACOUSTIC_DIM,
  prepareDecoderAcousticBuffers,
} from '../cfgAcoustics';

describe('decoder CFG acoustic routing', () => {
  it('keeps conditioned and null-conditioned placement features distinct and aligned', () => {
    const conditionedMap = new Float32Array(4 * DECODER_ACOUSTIC_DIM);
    const nullMap = new Float32Array(4 * DECODER_ACOUSTIC_DIM);
    for (let tick = 0; tick < 4; tick++) {
      conditionedMap.fill(10 + tick, tick * DECODER_ACOUSTIC_DIM, (tick + 1) * DECODER_ACOUSTIC_DIM);
      nullMap.fill(-10 - tick, tick * DECODER_ACOUSTIC_DIM, (tick + 1) * DECODER_ACOUSTIC_DIM);
    }

    const buffers = prepareDecoderAcousticBuffers(
      conditionedMap,
      nullMap,
      [1, 3],
      0,
      2,
      4,
    );

    expect(buffers.conditioned[0]).toBe(11);
    expect(buffers.nullConditioned[0]).toBe(-11);
    expect(buffers.conditioned[DECODER_ACOUSTIC_DIM]).toBe(13);
    expect(buffers.nullConditioned[DECODER_ACOUSTIC_DIM]).toBe(-13);
    expect(buffers.conditioned[2 * DECODER_ACOUSTIC_DIM]).toBe(0);
    expect(buffers.nullConditioned[2 * DECODER_ACOUSTIC_DIM]).toBe(0);
  });
});
