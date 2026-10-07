export const ENTERTAINMENT_SWAP_MS = 1050;
export const ENTERTAINMENT_DURATION_MS = 2400;

const smooth = (value: number) => {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
};

/** Collapse and reform the existing world; the landmark swap happens at rest. */
export function entertainmentFrame(elapsed: number) {
  return {
    collapse: elapsed < ENTERTAINMENT_SWAP_MS
      ? smooth((elapsed - 250) / 650)
      : 1 - smooth((elapsed - 1150) / 1100),
    phase: elapsed < 450 ? 'darken' : elapsed < ENTERTAINMENT_SWAP_MS ? 'collapse' : 'reform',
    complete: elapsed >= ENTERTAINMENT_DURATION_MS,
  };
}
