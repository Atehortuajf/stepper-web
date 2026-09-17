const MASKED_LOGIT_CUTOFF = -1e8;

/**
 * Select a legal chord token from masked logits.
 *
 * The caller is responsible for applying its policy mask. Values at or below
 * the FSM sentinel are treated as illegal even though the sentinel is finite.
 */
export function sampleChordToken(
  logits: ArrayLike<number>,
  temperature: number,
  random: () => number = Math.random,
): number {
  const legal: number[] = [];
  let maxLogit = -Infinity;

  // Token 0 is the rest token and does not correspond to a placed event.
  for (let token = 1; token < logits.length; token++) {
    const logit = logits[token];
    if (!Number.isFinite(logit) || logit <= MASKED_LOGIT_CUTOFF) continue;
    legal.push(token);
    if (logit > maxLogit) maxLogit = logit;
  }

  if (legal.length === 0) {
    throw new Error('No finite legal chord candidate after applying the inference mask');
  }

  if (temperature <= 0.1) {
    let chosen = legal[0];
    for (let i = 1; i < legal.length; i++) {
      const token = legal[i];
      if (logits[token] > logits[chosen]) chosen = token;
    }
    return chosen;
  }

  const weights = new Float64Array(legal.length);
  let totalWeight = 0;
  for (let i = 0; i < legal.length; i++) {
    const weight = Math.exp((logits[legal[i]] - maxLogit) / temperature);
    if (weight > 0 && Number.isFinite(weight)) {
      weights[i] = weight;
      totalWeight += weight;
    }
  }

  if (!(totalWeight > 0) || !Number.isFinite(totalWeight)) {
    throw new Error('No positive-probability legal chord candidate after temperature scaling');
  }

  const target = random() * totalWeight;
  let cumulative = 0;
  for (let i = 0; i < legal.length; i++) {
    const weight = weights[i];
    if (weight === 0) continue;
    cumulative += weight;
    if (target < cumulative) return legal[i];
  }

  // Guard against a random source returning 1 or floating-point accumulation drift.
  for (let i = legal.length - 1; i >= 0; i--) {
    if (weights[i] > 0) return legal[i];
  }
  throw new Error('No positive-probability legal chord candidate after temperature scaling');
}
