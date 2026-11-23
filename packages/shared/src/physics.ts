/**
 * Canonical GunBound / DragonBound closed-form ballistics.
 *
 * Single source of truth for:
 *  - acceleration vector from (wind power, wind angle, mobile by/bx)
 *  - muzzle origin from (x, y, facing, body angle, mobile id)
 *  - launch velocity from (angle deg, power %)
 *  - closed-form position at time t (analytic solve, no per-step integration)
 *
 * Both client (PixiJS) and server (Go mirror) MUST use these exact formulas.
 * Reference: AUDIT_REPORT.md §1.
 */

export interface PhysicsMobileDef {
  /** Per-mobile gravity baseline (Armor=398, Boomer=380, ...). */
  by: number;
  /** Per-mobile wind-deadening term on vertical axis (0 for most, Boomer uses it). */
  bx: number;
}

export interface AccelResult {
  ax: number;
  ay: number;
}

/**
 * Compute accelerations from wind + gravity.
 *
 * DragonBound canonical form:
 *   b0 = round(cos(wRad) * windPower * by) / 100
 *   b1 = round(sin(wRad) * windPower * by - bx) / 100
 *   ax = round(0 - b0)
 *   ay = round(by - b1)
 *
 * Wind angle convention:
 *   0°   = wind blows right (+X)
 *   180° = wind blows left (-X)
 *   90°  = wind blows up (-Y, lifts against gravity)
 *   270° = wind blows down (+Y)
 */
export function computeAccelerations(
  def: PhysicsMobileDef,
  windPower: number,
  windAngleDeg: number
): AccelResult {
  if (windPower === 0) {
    return { ax: 0, ay: Math.round(def.by) };
  }
  const rad = (windAngleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const b0 = Math.round(Math.floor(cos * windPower * def.by)) / 100;
  const b1 = Math.round(Math.floor(sin * windPower * def.by - def.bx)) / 100;
  const ax = Math.round(0 - b0);
  const ay = Math.round(def.by - b1);
  return { ax, ay };
}

/** Power 0..100 -> engine velocity (max 936 px/sec at power=100). */
export function computeLaunchSpeed(power: number): number {
  const scaledPower = (power / 100) * 400;
  const v0 = Math.floor((scaledPower * 234) / 100);
  return v0 <= 0 ? 234 : v0;
}

/** Analytic position at time t (ms). */
export function positionAtTime(
  x0: number,
  y0: number,
  vx: number,
  vy: number,
  ax: number,
  ay: number,
  tMs: number
): { x: number; y: number } {
  const a = tMs / 485;
  return {
    x: Math.ceil(x0 + vx * a + (ax * a * a) / 2),
    y: Math.ceil(y0 + vy * a + (ay * a * a) / 2),
  };
}

/**
 * Muzzle origin. Uses a single 24px barrel length anchored at (x, y-14).
 * Server canonical — kept identical to Go `SimulateProjectileAdv`.
 */
export function computeMuzzleShared(
  x: number,
  y: number,
  angleDeg: number,
  facing: 1 | -1
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const muzzleOffset = 24;
  return {
    x: x + muzzleOffset * Math.cos(rad) * facing,
    y: y - 14 - muzzleOffset * Math.sin(rad),
  };
}
