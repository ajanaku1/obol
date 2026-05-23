/**
 * Pay-to-unlock pricing.
 *
 * Obol works first, fronting the USDC for every vendor call from its own
 * Gateway balance. The user pays nothing up front; once Obol has an answer it
 * charges what it spent plus a margin, and the answer unlocks on payment.
 */

/** Obol's markup over what it actually spent — its margin for the work. */
export const MARKUP = 1.15;

/** What the user pays to unlock: Obol's spend plus the markup, in base units. */
export const priceBaseUnits = (spentBaseUnits: number): number =>
  Math.ceil(spentBaseUnits * MARKUP);

/**
 * The spend ceiling Obol may front, given the most the user will pay. Keeping
 * `spend * MARKUP <= ceiling` guarantees the unlock price never exceeds it.
 */
export const ceilingToBudget = (ceilingUsdc: number): number => ceilingUsdc / MARKUP;

export const usdc = (baseUnits: number): string => `$${(baseUnits / 1_000_000).toFixed(6)}`;
