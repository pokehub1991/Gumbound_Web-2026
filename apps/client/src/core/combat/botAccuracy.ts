/**
 * Bot hit probability gate.
 *
 * Contract: the chance of a bot landing a hit is always inside [0.50, 0.75].
 * Distance and wind only move the value within that band.
 */
export function botHitThreshold(difficulty: number, targetDistance: number, windPower: number): number {
  const distFactor = Math.min(0.2, (Math.abs(targetDistance) / 1200) * 0.2);
  const windFactor = Math.min(0.12, (Math.max(0, windPower) / 26) * 0.12);
  return Math.max(0.5, Math.min(0.75, difficulty - distFactor - windFactor));
}
