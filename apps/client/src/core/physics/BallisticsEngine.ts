import { MOBILES_DATA, MobileDef } from "../constants/mobiles.js";

export interface Point2D {
  x: number;
  y: number;
}

export interface TrajectoryPoint {
  x: number;
  y: number;
  timeMs: number;
  tangentAngle: number;
  isSpecialPhase?: boolean;
  weatherEffect?: "sun" | "lightning" | "mirror" | "tornado" | "black";
}

export interface ShotTrajectory {
  id: string;
  subType: string;
  points: TrajectoryPoint[];
  finalPos: Point2D;
  hitType: "ground" | "player" | "oob";
  flightDurationMs: number;
  bungeRadius: number;
  damage: number;
  weaponFile: string;
  explodeFile: string;
  soundFire: string;
  soundExplode: string;
  launchDelayMs?: number;
  isSunBuffed?: boolean;
  isLightningCharged?: boolean;
  extraMeta?: Record<string, unknown>;
}

export interface FireParams {
  x: number;
  y: number;
  rawAngle: number;
  power: number; // 0 - 100
  look: number; // 0 = left, 1 = right
  bodyAngle: number; // in degrees
  mobileId: number;
  shotType: number; // 0 = Shot1, 1 = Shot2, 2 = SS
  windPower: number; // 0 - 26
  windAngle: number; // 0 - 360 degrees
  isPixelSolid: (x: number, y: number) => boolean;
  mapWidth: number;
  mapHeight: number;
  targets?: { id: string; x: number; y: number; radius: number }[];
  activeWeatherColumn?: {
    id: number;
    type: string;
    x: number;
    width: number;
  } | null;
}

export class BallisticsEngine {
  public static rotatePoint(point: Point2D, center: Point2D, angleDeg: number): Point2D {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return {
      x: Math.round(center.x + dx * cos - dy * sin),
      y: Math.round(center.y + dx * sin + dy * cos),
    };
  }

  public static computeAccelerations(mobile: MobileDef, windPower: number, windAngleDeg: number) {
    if (windPower === 0) {
      return { ax: 0, ay: mobile.by };
    }
    const rad = (windAngleDeg * Math.PI) / 180;
    const b0 = Math.round(Math.floor(Math.cos(rad) * windPower * mobile.by)) / 100;
    const b1 = Math.round(Math.floor(Math.sin(rad) * windPower * mobile.by - mobile.bx)) / 100;
    const ax = Math.round(0 - b0);
    const ay = Math.round(mobile.by - b1);
    return { ax, ay };
  }

  public static computeMuzzle(x: number, y: number, look: number, bodyAngle: number, mobileId: number) {
    let dis = 0;
    if (look === 0) {
      dis = mobileId === 2 /* ADUKA */ ? 26 : -11;
    } else {
      dis = mobileId === 2 /* ADUKA */ ? -26 : 11;
    }

    const point = {
      x: x + dis,
      y: mobileId === 2 ? y - 31 : y - 28,
    };

    return this.rotatePoint(point, { x, y }, bodyAngle);
  }

  public static simulateShot(params: FireParams): ShotTrajectory[] {
    const mobile = MOBILES_DATA[params.mobileId] || MOBILES_DATA[0];
    const muzzle = this.computeMuzzle(params.x, params.y, params.look, params.bodyAngle, params.mobileId);

    // Initial angle calculation
    let effectiveAngle = params.look === 0 ? 180 - params.rawAngle : params.rawAngle;
    effectiveAngle -= params.bodyAngle;

    // Power scale conversion (0-100% maps to GunBound 0-400 power units, scaling v0 up to 936 px/sec)
    const scaledPower = (params.power / 100) * 400;
    const v0 = Math.floor((scaledPower * 234) / 100);

    // Accelerations
    const { ax, ay } = this.computeAccelerations(mobile, params.windPower, params.windAngle);

    // Specific Armor (mobileId === 0) mechanics
    if (params.mobileId === 0) {
      if (params.shotType === 0) {
        return [this.simulateArmorShot1(muzzle, effectiveAngle, v0, ax, ay, mobile, params)];
      } else if (params.shotType === 1) {
        return [this.simulateArmorShot2(muzzle, effectiveAngle, v0, ax, ay, mobile, params)];
      } else if (params.shotType === 2) {
        return [this.simulateArmorSS(muzzle, effectiveAngle, v0, ax, ay, mobile, params)];
      }
    }

    // Multi-shot and special mechanics routing
    if (params.mobileId === 13 && params.shotType === 1) {
      // Mage Shot 2: Braided Sinusoidal Twin Stream
      return this.simulateMageShot2(muzzle, effectiveAngle, v0, ax, ay, mobile, params);
    } else if (params.mobileId === 14 && params.shotType === 1) {
      // Turtle Shot 2: TimeBomb 4-Phase Fork
      return this.simulateTurtleShot2(muzzle, effectiveAngle, v0, ax, ay, mobile, params);
    } else if (params.mobileId === 4 && params.shotType === 0) {
      // Bigfoot Shot 1: 4 Missiles Staggered Salvo (Authentic GunBound)
      return this.simulateBigfootShot1(muzzle, effectiveAngle, v0, ax, ay, mobile, params);
    } else if (params.mobileId === 4 && params.shotType === 1) {
      // Bigfoot Shot 2: 6 Missiles in 2 Waves
      return this.simulateBigfootShot2(muzzle, effectiveAngle, v0, ax, ay, mobile, params);
    } else if (params.mobileId === 4 && params.shotType === 2) {
      // Bigfoot SS: 8 Missiles Concentrated Barrage
      return this.simulateBigfootSS(muzzle, effectiveAngle, v0, ax, ay, mobile, params);
    } else if (params.mobileId === 1 && params.shotType === 1) {
      // Ice Shot 2: 2 Ice Flakes
      return this.simulateIceShot2(muzzle, effectiveAngle, v0, ax, ay, mobile, params);
    } else if (params.mobileId === 17 && params.shotType === 1) {
      // Grub Shot 2: 2 Bouncing Rolling Balls
      return this.simulateGrubShot2(muzzle, effectiveAngle, v0, ax, ay, mobile, params);
    } else if (params.mobileId === 12 && params.shotType === 1) {
      // Trico Shot 2: 3 Revolving Cabbages
      return this.simulateTricoShot(muzzle, effectiveAngle, v0, ax, ay, mobile, params);
    } else if (params.mobileId === 15 && params.shotType === 1) {
      // Boomer Shot 2: 4 Boomerangs
      return this.simulateBoomerShot2(muzzle, effectiveAngle, v0, ax, ay, mobile, params);
    } else if (params.mobileId === 19 && params.shotType === 1) {
      // Raon Shot 2: Twin Walking Mines
      return this.simulateRaonShot2(muzzle, effectiveAngle, v0, ax, ay, mobile, params);
    } else if (params.mobileId === 11 && params.shotType === 1) {
      // Nak Shot 2: Subterranean Burrowing Shot
      return this.simulateNakShot2(muzzle, effectiveAngle, v0, ax, ay, mobile, params);
    } else if (params.mobileId === 2 && params.shotType === 1) {
      // Aduka Shot 2: 3 Tracker Shots + Thor Satellite Laser
      return this.simulateAdukaShot2(muzzle, effectiveAngle, v0, ax, ay, mobile, params);
    } else if (params.mobileId === 6 && params.shotType < 2) {
      // ASate: Beacon + Ion Satellite Laser
      return this.simulateASateShot(muzzle, effectiveAngle, v0, ax, ay, mobile, params);
    } else if (params.mobileId === 8 && params.shotType < 2) {
      // Knight: Beacon + Converging Light Sabers
      return this.simulateKnightShot(muzzle, effectiveAngle, v0, ax, ay, mobile, params);
    } else if (params.mobileId === 3 && params.shotType === 1) {
      // Lightning: Electrical Orb + Descending Lightning Bolt
      return this.simulateLightningShot(muzzle, effectiveAngle, v0, ax, ay, mobile, params);
    } else if (params.mobileId === 9 && params.shotType === 1) {
      // Fox Shot 2: 2 Fireballs
      return this.simulateFoxShot2(muzzle, effectiveAngle, v0, ax, ay, mobile, params);
    } else if (params.mobileId === 10 && params.shotType === 1) {
      // Dragon Shot 2: 4 Comets
      return this.simulateDragonShot2(muzzle, effectiveAngle, v0, ax, ay, mobile, params);
    } else if (params.mobileId === 23 && params.shotType === 1) {
      // Maya Shot 2: 2 Heavy Shells
      return this.simulateMayaShot2(muzzle, effectiveAngle, v0, ax, ay, mobile, params);
    } else if (params.mobileId === 22) {
      // Kalsiddon: Multi-missiles for Shot 1, 2, and SS
      return this.simulateKalsiddonShot(muzzle, effectiveAngle, v0, ax, ay, mobile, params);
    }

    // Default Single Shot Simulation
    return [this.simulateSingleTrajectory(muzzle, effectiveAngle, v0, ax, ay, 0, mobile, params)];
  }

  public static simulateSingleTrajectory(
    origin: Point2D,
    angleDeg: number,
    v0: number,
    ax: number,
    ay: number,
    delayMs: number,
    mobile: MobileDef,
    params: FireParams,
    overrideDamage?: number,
    overrideBunge?: number
  ): ShotTrajectory {
    const rad = (angleDeg * Math.PI) / 180;
    const vx = Math.cos(rad) * v0;
    const vy = -Math.sin(rad) * v0;

    const points: TrajectoryPoint[] = [];
    let hitType: "ground" | "player" | "oob" = "oob";
    let finalPos: Point2D = { ...origin };

    const maxMs = 16000;
    const stepMs = 8; // High-precision sub-stepping
    const dt = stepMs / 1000;

    let curX = origin.x;
    let curY = origin.y;
    let curVx = vx;
    let curVy = vy;

    let isSunBuffed = false;
    let isLightningCharged = false;
    let isBlackDamped = false;
    let hasMirrored = false;
    const col = params.activeWeatherColumn;

    let prevX = origin.x;
    let prevY = origin.y;

    let tornadoPhase: 0 | 1 | 2 = 0; // 0 = outside, 1 = in 360 loop, 2 = exited loop
    let tornadoLoopAngle = 0;
    let tornadoLoopCenter = { x: 0, y: 0 };
    let tornadoLoopRadius = 36;
    let tornadoEntrySpeed = 0;
    let tornadoDir = 1;
    let tornadoProgress = 0;

    for (let tMs = 0; tMs <= maxMs; tMs += stepMs) {
      let x = origin.x;
      let y = origin.y;
      let velX = vx;
      let velY = vy;

      if (tMs === 0) {
        x = curX;
        y = curY;
        velX = curVx;
        velY = curVy;
      } else {
        // In-world weather column physics interactions
        if (col) {
          const distFromCenter = curX - col.x;
          const halfWidth = col.width / 2;

          if (col.type === "sun" && Math.abs(distFromCenter) <= halfWidth) {
            isSunBuffed = true;
          } else if (col.type === "lightning" && Math.abs(distFromCenter) <= halfWidth) {
            isLightningCharged = true;
          } else if (col.type === "black" && Math.abs(distFromCenter) <= halfWidth) {
            isBlackDamped = true;
          } else if (col.type === "mirror" && !hasMirrored && Math.abs(distFromCenter) <= 18 && tMs > 100) {
            curVx = -curVx * 0.90;
            hasMirrored = true;
          } else if (col.type === "tornado") {
            // Authentic GunBound Tornado cyclonic 360-degree vortex looping physics:
            if (tornadoPhase === 0 && Math.abs(distFromCenter) <= halfWidth) {
              tornadoPhase = 1;
              tornadoDir = curVx < 0 ? -1 : 1;
              tornadoEntrySpeed = Math.hypot(curVx, curVy);
              tornadoLoopRadius = Math.min(42, Math.max(28, col.width * 0.32));
              tornadoLoopCenter = { x: col.x, y: curY - 10 };
              tornadoLoopAngle = Math.atan2(curY - tornadoLoopCenter.y, curX - tornadoLoopCenter.x);
              tornadoProgress = 0;
            }

            if (tornadoPhase === 1) {
              const angularSpeed = 16.0; // Fast and snappy 360-degree cyclonic loop (~0.39s)
              tornadoProgress += angularSpeed * dt;
              tornadoLoopAngle += angularSpeed * tornadoDir;
              tornadoLoopCenter.y -= 130 * dt; // Cyclonic updraft suction lifts bullet
              curX = tornadoLoopCenter.x + Math.cos(tornadoLoopAngle) * tornadoLoopRadius;
              curY = tornadoLoopCenter.y + Math.sin(tornadoLoopAngle) * tornadoLoopRadius;
              curVx = -Math.sin(tornadoLoopAngle) * tornadoLoopRadius * angularSpeed * tornadoDir;
              curVy = Math.cos(tornadoLoopAngle) * tornadoLoopRadius * angularSpeed * tornadoDir - 130;

              if (tornadoProgress >= Math.PI * 2.15) {
                tornadoPhase = 2; // Loop complete, exit funnel
                curVx = tornadoDir * Math.max(280, tornadoEntrySpeed * 0.95);
                curVy = -Math.max(120, tornadoEntrySpeed * 0.35);
              }
            }
          } else if (col.type === "random" && Math.abs(distFromCenter) <= halfWidth) {
            // Random column with cascading items (Sun, Lightning, Mirror, Tornado, Black):
            // Calculate which cascading item is at current Y height!
            // Items repeat in a 5-item cycle spaced every 140px, falling smoothly at 34px/s
            const cycleHeight = 700;
            const scrollOffset = (tMs * 0.034) % cycleHeight;
            const normY = (((curY + scrollOffset) % cycleHeight) + cycleHeight) % cycleHeight;
            const itemIdx = Math.floor(normY / 140); // 0 = sun, 1 = lightning, 2 = mirror, 3 = tornado, 4 = black

            if (itemIdx === 0) {
              isSunBuffed = true;
            } else if (itemIdx === 1) {
              isLightningCharged = true;
            } else if (itemIdx === 2 && !hasMirrored && tMs > 100) {
              curVx = -curVx * 0.90;
              hasMirrored = true;
            } else if (itemIdx === 3) {
              // Touching the Tornado badge triggers the cyclonic loop!
              if (tornadoPhase === 0) {
                tornadoPhase = 1;
                tornadoDir = curVx < 0 ? -1 : 1;
                tornadoEntrySpeed = Math.hypot(curVx, curVy);
                tornadoLoopRadius = 32;
                tornadoLoopCenter = { x: col.x, y: curY - 10 };
                tornadoLoopAngle = Math.atan2(curY - tornadoLoopCenter.y, curX - tornadoLoopCenter.x);
                tornadoProgress = 0;
              }
            } else if (itemIdx === 4) {
              isBlackDamped = true;
            }
          }
        }

        if (tornadoPhase !== 1) {
          curVx += ax * dt;
          curVy += ay * dt;
          curX += curVx * dt;
          curY += curVy * dt;
        }

        x = curX;
        y = curY;
        velX = curVx;
        velY = curVy;
      }

      // Smooth analytical velocity tangent vector
      const tang = (Math.atan2(velY, velX) * 180) / Math.PI;

      // Special transformation check (Armor SS or Turtle SS open phase)
      const isSpecialPhase =
        (mobile.id === 0 && params.shotType === 2 && tMs >= 1540) ||
        (mobile.id === 14 && params.shotType === 2 && tMs >= 1540);

      // Continuous collision detection (CCD) against terrain along trajectory segment
      if (tMs > 0) {
        const segDist = Math.hypot(x - prevX, y - prevY);
        const subSteps = Math.max(1, Math.ceil(segDist / 2));
        let hitTerrain = false;

        for (let s = 1; s <= subSteps; s++) {
          const factor = s / subSteps;
          const cx = prevX + (x - prevX) * factor;
          const cy = prevY + (y - prevY) * factor;
          const distFromMuzzle = Math.hypot(cx - origin.x, cy - origin.y);

          // Clear tiny 5px radius right at the muzzle aperture, then collide with any solid terrain
          // Guarantees bullets never pass through thin overhangs, ledges or sharp terrain tips
          if (distFromMuzzle >= 5 && params.isPixelSolid(Math.round(cx), Math.round(cy))) {
            const activeWeatherEffect = isSunBuffed
              ? "sun"
              : isLightningCharged
              ? "lightning"
              : hasMirrored
              ? "mirror"
              : tornadoPhase > 0
              ? "tornado"
              : isBlackDamped
              ? "black"
              : undefined;

            hitType = "ground";
            finalPos = { x: Math.round(cx), y: Math.round(cy) };
            points.push({
              x: cx,
              y: cy,
              timeMs: tMs - stepMs + stepMs * factor,
              tangentAngle: tang,
              isSpecialPhase,
              weatherEffect: activeWeatherEffect,
            });
            hitTerrain = true;
            break;
          }
        }

        if (hitTerrain) {
          break;
        }
      }

      const activeWeatherEffect = isSunBuffed
        ? "sun"
        : isLightningCharged
        ? "lightning"
        : hasMirrored
        ? "mirror"
        : tornadoPhase > 0
        ? "tornado"
        : isBlackDamped
        ? "black"
        : undefined;

      points.push({
        x,
        y,
        timeMs: tMs,
        tangentAngle: tang,
        isSpecialPhase,
        weatherEffect: activeWeatherEffect,
      });

      // 1. Mobile Enemy Collision check (skip initial launch to clear muzzle)
      if (tMs >= 80 && params.targets && params.targets.length > 0) {
        let hitMobile = false;
        for (const target of params.targets) {
          if (Math.hypot(x - target.x, y - target.y) <= target.radius) {
            hitType = "player";
            finalPos = { x, y };
            hitMobile = true;
            break;
          }
        }
        if (hitMobile) break;
      }

      // 2. Out of bounds check: wide margins allow shots to fly high into sky and completely off screen
      if (x < -1200 || x > params.mapWidth + 1200 || y > params.mapHeight + 450) {
        hitType = "oob";
        finalPos = { x, y };
        break;
      }

      prevX = x;
      prevY = y;
    }

    const isSS = params.shotType === 2;
    const shotKey = isSS ? "ss" : params.shotType === 1 ? "shot2" : "shot1";
    let damage = overrideDamage ?? mobile.baseDamage[shotKey];
    let bunge = overrideBunge ?? mobile.palaBunge[shotKey];

    // Armor SS bonus if flight time >= 1540 ms
    if (mobile.id === 0 && isSS) {
      const lastPoint = points[points.length - 1];
      if (lastPoint && lastPoint.timeMs >= 1540) {
        damage = 560; // Devastating hit
        bunge = 65;
      }
    }

    // Authentic Weather column damage & bunge modifiers
    if (isSunBuffed) {
      damage = Math.round(damage * 1.35);
      bunge = Math.round(bunge * 1.25);
    }
    if (isLightningCharged) {
      damage = Math.round(damage + 75);
    }
    if (isBlackDamped) {
      damage = Math.round(damage * 0.75);
    }

    return {
      id: `${mobile.key}_shot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      subType: "single",
      points,
      finalPos,
      hitType,
      flightDurationMs: points[points.length - 1]?.timeMs || 0,
      bungeRadius: bunge,
      damage,
      weaponFile: mobile.file,
      explodeFile: "armor1.png",
      soundFire: "11fire",
      soundExplode: "11blast",
      launchDelayMs: delayMs,
      isSunBuffed,
      isLightningCharged,
    };
  }

  // --- SPECIAL WEAPONS SIMULATIONS ---

  private static simulateMageShot2(
    origin: Point2D,
    angleDeg: number,
    v0: number,
    ax: number,
    ay: number,
    _mobile: MobileDef,
    params: FireParams
  ): ShotTrajectory[] {
    const rad = (angleDeg * Math.PI) / 180;
    const vx = Math.cos(rad) * v0;
    const vy = -Math.sin(rad) * v0;

    const pointsA: TrajectoryPoint[] = [];
    const pointsB: TrajectoryPoint[] = [];
    let hitPos = { ...origin };

    for (let tMs = 0; tMs <= 16000; tMs += 8) {
      const p = tMs / 1000;
      const baseX = origin.x + vx * p + (ax * p * p) / 2;
      const baseY = origin.y + vy * p + (ay * p * p) / 2;

      const prevP = Math.max(0, (tMs - 12) / 1000);
      const prevX = origin.x + vx * prevP + (ax * prevP * prevP) / 2;
      const prevY = origin.y + vy * prevP + (ay * prevP * prevP) / 2;
      const tang = Math.atan2(baseY - prevY, baseX - prevX);

      // Sinusoidal wave offset perpendicular to tangent
      const wave = Math.sin(tMs / 60) * 16;
      const perpX = -Math.sin(tang);
      const perpY = Math.cos(tang);

      const axPt = baseX + perpX * wave;
      const ayPt = baseY + perpY * wave;

      const bxPt = baseX - perpX * wave;
      const byPt = baseY - perpY * wave;

      pointsA.push({ x: axPt, y: ayPt, timeMs: tMs, tangentAngle: (tang * 180) / Math.PI });
      pointsB.push({ x: bxPt, y: byPt, timeMs: tMs, tangentAngle: (tang * 180) / Math.PI });

      const distFromOrigin = Math.hypot(baseX - origin.x, baseY - origin.y);
      if (distFromOrigin >= 5 && (params.isPixelSolid(Math.round(axPt), Math.round(ayPt)) || params.isPixelSolid(Math.round(bxPt), Math.round(byPt)))) {
        hitPos = { x: Math.round(baseX), y: Math.round(baseY) };
        break;
      }
    }

    return [
      {
        id: `mage_2a_${Date.now()}`,
        subType: "mage_helix_a",
        points: pointsA,
        finalPos: hitPos,
        hitType: "ground",
        flightDurationMs: pointsA[pointsA.length - 1]?.timeMs || 0,
        bungeRadius: 36,
        damage: 100,
        weaponFile: "mage2a.png",
        explodeFile: "mage1.png",
        soundFire: "21fire",
        soundExplode: "22blast",
        launchDelayMs: 0,
      },
      {
        id: `mage_2b_${Date.now()}`,
        subType: "mage_helix_b",
        points: pointsB,
        finalPos: hitPos,
        hitType: "ground",
        flightDurationMs: pointsB[pointsB.length - 1]?.timeMs || 0,
        bungeRadius: 36,
        damage: 100,
        weaponFile: "mage2b.png",
        explodeFile: "mage1.png",
        soundFire: "21fire",
        soundExplode: "22blast",
        launchDelayMs: 0,
      },
    ];
  }

  private static simulateTurtleShot2(
    origin: Point2D,
    angleDeg: number,
    v0: number,
    ax: number,
    ay: number,
    _mobile: MobileDef,
    params: FireParams
  ): ShotTrajectory[] {
    const rad = (angleDeg * Math.PI) / 180;
    const vx = Math.cos(rad) * v0;
    const vy = -Math.sin(rad) * v0;

    const pointsA: TrajectoryPoint[] = [];
    const pointsB: TrajectoryPoint[] = [];
    let hitPos = { ...origin };

    for (let tMs = 0; tMs <= 16000; tMs += 8) {
      const p = tMs / 1000;
      const baseX = origin.x + vx * p + (ax * p * p) / 2;
      const baseY = origin.y + vy * p + (ay * p * p) / 2;

      const prevP = Math.max(0, (tMs - 12) / 1000);
      const prevX = origin.x + vx * prevP + (ax * prevP * prevP) / 2;
      const prevY = origin.y + vy * prevP + (ay * prevP * prevP) / 2;
      const tang = Math.atan2(baseY - prevY, baseX - prevX);

      // Authentic 4-phase separation & reconvergence
      let dist = 0;
      if (tMs < 400) {
        dist = (tMs / 400) * 25;
      } else if (tMs < 2200) {
        dist = 25 * Math.cos((tMs - 400) / 95);
      } else if (tMs < 2600) {
        dist = 25 - ((tMs - 2200) / 400) * 22;
      } else {
        dist = 3;
      }

      const perpX = -Math.sin(tang);
      const perpY = Math.cos(tang);

      const axPt = baseX + perpX * dist;
      const ayPt = baseY + perpY * dist;
      const bxPt = baseX - perpX * dist;
      const byPt = baseY - perpY * dist;

      pointsA.push({ x: axPt, y: ayPt, timeMs: tMs, tangentAngle: (tang * 180) / Math.PI });
      pointsB.push({ x: bxPt, y: byPt, timeMs: tMs, tangentAngle: (tang * 180) / Math.PI });

      const distFromOrigin = Math.hypot(baseX - origin.x, baseY - origin.y);
      if (distFromOrigin >= 5 && (params.isPixelSolid(Math.round(axPt), Math.round(ayPt)) || params.isPixelSolid(Math.round(bxPt), Math.round(byPt)))) {
        hitPos = { x: Math.round(baseX), y: Math.round(baseY) };
        break;
      }
    }

    return [
      {
        id: `turtle_2a_${Date.now()}`,
        subType: "turtle_timebomb_a",
        points: pointsA,
        finalPos: hitPos,
        hitType: "ground",
        flightDurationMs: pointsA[pointsA.length - 1]?.timeMs || 0,
        bungeRadius: 45,
        damage: 150,
        weaponFile: "turtle12a.png",
        explodeFile: "turtle12.png",
        soundFire: "121fire",
        soundExplode: "121blast",
        launchDelayMs: 0,
      },
      {
        id: `turtle_2b_${Date.now()}`,
        subType: "turtle_timebomb_b",
        points: pointsB,
        finalPos: hitPos,
        hitType: "ground",
        flightDurationMs: pointsB[pointsB.length - 1]?.timeMs || 0,
        bungeRadius: 45,
        damage: 150,
        weaponFile: "turtle12a.png",
        explodeFile: "turtle12.png",
        soundFire: "121fire",
        soundExplode: "121blast",
        launchDelayMs: 0,
      },
    ];
  }

  // --- BIGFOOT SALVOS ---

  private static simulateBigfootShot1(
    origin: Point2D,
    angleDeg: number,
    v0: number,
    ax: number,
    ay: number,
    mobile: MobileDef,
    params: FireParams
  ): ShotTrajectory[] {
    // Authentic GunBound / DragonBound: 4 missiles with staggered launch delays (0, 100, 200, 300 ms)
    const list: ShotTrajectory[] = [];
    const specs = [
      { ang: 0, pwr: 0, delay: 0 },
      { ang: 4, pwr: 10, delay: 100 },
      { ang: -2, pwr: -10, delay: 200 },
      { ang: 6, pwr: 20, delay: 300 },
    ];

    for (let i = 0; i < specs.length; i++) {
      const s = specs[i];
      const traj = this.simulateSingleTrajectory(
        origin,
        angleDeg + s.ang,
        v0 + s.pwr,
        ax,
        ay,
        s.delay,
        mobile,
        params,
        60,
        28
      );
      traj.id = `bigfoot_shot1_${i}`;
      list.push(traj);
    }
    return list;
  }

  private static simulateBigfootShot2(
    origin: Point2D,
    angleDeg: number,
    v0: number,
    ax: number,
    ay: number,
    mobile: MobileDef,
    params: FireParams
  ): ShotTrajectory[] {
    // Authentic GunBound: 6 rockets in 2 staggered salvos of 3 rockets each
    const list: ShotTrajectory[] = [];
    const specs = [
      // Wave 1: 3 spread rockets at delay 0ms
      { ang: 0, pwr: 0, delay: 0 },
      { ang: 5, pwr: 15, delay: 0 },
      { ang: 10, pwr: 30, delay: 0 },
      // Wave 2: 3 spread rockets at delay 120ms
      { ang: 0, pwr: 0, delay: 120 },
      { ang: 5, pwr: 15, delay: 120 },
      { ang: 10, pwr: 30, delay: 120 },
    ];

    for (let i = 0; i < specs.length; i++) {
      const s = specs[i];
      const traj = this.simulateSingleTrajectory(
        origin,
        angleDeg + s.ang,
        v0 + s.pwr,
        ax,
        ay,
        s.delay,
        mobile,
        params,
        55,
        25
      );
      traj.id = `bigfoot_shot2_${i}`;
      list.push(traj);
    }
    return list;
  }

  private static simulateBigfootSS(
    origin: Point2D,
    angleDeg: number,
    v0: number,
    ax: number,
    ay: number,
    mobile: MobileDef,
    params: FireParams
  ): ShotTrajectory[] {
    // Authentic GunBound SS: 8 concentrated missiles in rapid succession
    const list: ShotTrajectory[] = [];
    const specs = [
      { ang: 0, pwr: 0, delay: 0 },
      { ang: 4, pwr: 10, delay: 50 },
      { ang: -2, pwr: -10, delay: 100 },
      { ang: 6, pwr: 20, delay: 150 },
      { ang: 1, pwr: 0, delay: 200 },
      { ang: 3, pwr: 10, delay: 225 },
      { ang: -1, pwr: -10, delay: 300 },
      { ang: 5, pwr: 20, delay: 350 },
    ];

    for (let i = 0; i < specs.length; i++) {
      const s = specs[i];
      const traj = this.simulateSingleTrajectory(
        origin,
        angleDeg + s.ang,
        v0 + s.pwr,
        ax,
        ay,
        s.delay,
        mobile,
        params,
        65,
        28
      );
      traj.id = `bigfoot_ss_${i}`;
      list.push(traj);
    }
    return list;
  }

  // --- ARMOR MOBILES ---

  private static simulateArmorShot1(
    origin: Point2D,
    angleDeg: number,
    v0: number,
    ax: number,
    ay: number,
    mobile: MobileDef,
    params: FireParams
  ): ShotTrajectory {
    const traj = this.simulateSingleTrajectory(origin, angleDeg, v0, ax, ay, 0, mobile, params, 150, 43);
    traj.id = `armor_shot1_${Date.now()}`;
    traj.weaponFile = "armor1.png";
    traj.explodeFile = "armor1.png";
    traj.soundFire = "11fire";
    traj.soundExplode = "11blast";
    traj.damage = 150;
    traj.bungeRadius = 43;
    return traj;
  }

  private static simulateArmorShot2(
    origin: Point2D,
    angleDeg: number,
    v0: number,
    ax: number,
    ay: number,
    mobile: MobileDef,
    params: FireParams
  ): ShotTrajectory {
    // Authentic GunBound Armor Shot 2: 1 heavy armor missile (306 damage)
    const traj = this.simulateSingleTrajectory(origin, angleDeg, v0, ax, ay, 0, mobile, params, 306, 45);
    traj.id = `armor_shot2_${Date.now()}`;
    traj.weaponFile = "armor2.png";
    traj.explodeFile = "armor2.png";
    traj.soundFire = "12fire";
    traj.soundExplode = "11blast";
    traj.damage = 306;
    traj.bungeRadius = 45;
    traj.launchDelayMs = 0;
    return traj;
  }

  private static simulateArmorSS(
    origin: Point2D,
    angleDeg: number,
    v0: number,
    ax: number,
    ay: number,
    mobile: MobileDef,
    params: FireParams
  ): ShotTrajectory {
    // Authentic GunBound Armor Super Shot:
    // Transforms at >= 1540 ms into ArmorSSopen with massive damage and bunge bonus!
    const traj = this.simulateSingleTrajectory(origin, angleDeg, v0, ax, ay, 0, mobile, params);
    traj.id = `armor_ss_${Date.now()}`;
    traj.weaponFile = "armorSS.png";
    traj.explodeFile = "armorSS.png";
    traj.soundFire = "12fire";
    traj.soundExplode = "11blast";

    const lastPoint = traj.points[traj.points.length - 1];
    const isOpen = lastPoint && lastPoint.timeMs >= 1540;

    if (isOpen) {
      traj.damage = 580; // Devastating hit
      traj.bungeRadius = 65; // Massive crater
      traj.extraMeta = { isOpen: true };
    } else {
      traj.damage = 400;
      traj.bungeRadius = 50;
      traj.extraMeta = { isOpen: false };
    }

    return traj;
  }

  private static simulateIceShot2(
    origin: Point2D,
    angleDeg: number,
    v0: number,
    ax: number,
    ay: number,
    mobile: MobileDef,
    params: FireParams
  ): ShotTrajectory[] {
    const traj1 = this.simulateSingleTrajectory(origin, angleDeg, v0, ax, ay, 0, mobile, params, 130, 36);
    const traj2 = this.simulateSingleTrajectory(origin, angleDeg + 2, v0 + 6, ax, ay, 110, mobile, params, 130, 36);
    traj1.id = `ice_2_a`;
    traj2.id = `ice_2_b`;
    return [traj1, traj2];
  }

  private static simulateGrubShot2(
    origin: Point2D,
    angleDeg: number,
    v0: number,
    ax: number,
    ay: number,
    mobile: MobileDef,
    params: FireParams
  ): ShotTrajectory[] {
    const traj1 = this.simulateSingleTrajectory(origin, angleDeg, v0, ax, ay, 0, mobile, params, 120, 32);
    const traj2 = this.simulateSingleTrajectory(origin, angleDeg + 3, v0 + 8, ax, ay, 110, mobile, params, 120, 32);
    traj1.id = `grub_2_a`;
    traj2.id = `grub_2_b`;
    return [traj1, traj2];
  }

  private static simulateFoxShot2(
    origin: Point2D,
    angleDeg: number,
    v0: number,
    ax: number,
    ay: number,
    mobile: MobileDef,
    params: FireParams
  ): ShotTrajectory[] {
    const traj1 = this.simulateSingleTrajectory(origin, angleDeg, v0, ax, ay, 0, mobile, params, 140, 35);
    const traj2 = this.simulateSingleTrajectory(origin, angleDeg + 3, v0 + 8, ax, ay, 100, mobile, params, 140, 35);
    traj1.id = `fox_2_a`;
    traj2.id = `fox_2_b`;
    return [traj1, traj2];
  }

  private static simulateDragonShot2(
    origin: Point2D,
    angleDeg: number,
    v0: number,
    ax: number,
    ay: number,
    mobile: MobileDef,
    params: FireParams
  ): ShotTrajectory[] {
    const list: ShotTrajectory[] = [];
    for (let i = 0; i < 4; i++) {
      const traj = this.simulateSingleTrajectory(
        origin,
        angleDeg + (i - 1.5) * 1.5,
        v0 + i * 5,
        ax,
        ay,
        i * 75,
        mobile,
        params,
        95,
        35
      );
      traj.id = `dragon_2_${i}`;
      list.push(traj);
    }
    return list;
  }

  private static simulateMayaShot2(
    origin: Point2D,
    angleDeg: number,
    v0: number,
    ax: number,
    ay: number,
    mobile: MobileDef,
    params: FireParams
  ): ShotTrajectory[] {
    const traj1 = this.simulateSingleTrajectory(origin, angleDeg, v0, ax, ay, 0, mobile, params, 180, 42);
    const traj2 = this.simulateSingleTrajectory(origin, angleDeg + 2, v0 + 6, ax, ay, 110, mobile, params, 180, 42);
    traj1.id = `maya_2_a`;
    traj2.id = `maya_2_b`;
    return [traj1, traj2];
  }

  private static simulateKalsiddonShot(
    origin: Point2D,
    angleDeg: number,
    v0: number,
    ax: number,
    ay: number,
    mobile: MobileDef,
    params: FireParams
  ): ShotTrajectory[] {
    const count = params.shotType === 2 ? 6 : params.shotType === 1 ? 4 : 2;
    const list: ShotTrajectory[] = [];
    for (let i = 0; i < count; i++) {
      const spreadAng = (i - (count - 1) / 2) * 2;
      const speedSpread = (i % 2) * 8;
      const traj = this.simulateSingleTrajectory(
        origin,
        angleDeg + spreadAng,
        v0 + speedSpread,
        ax,
        ay,
        i * 80,
        mobile,
        params,
        Math.round(260 / count),
        28
      );
      traj.id = `kalsiddon_${params.shotType}_${i}`;
      list.push(traj);
    }
    return list;
  }

  private static simulateTricoShot(
    origin: Point2D,
    angleDeg: number,
    v0: number,
    ax: number,
    ay: number,
    mobile: MobileDef,
    params: FireParams
  ): ShotTrajectory[] {
    const list: ShotTrajectory[] = [];
    for (let i = 0; i < 3; i++) {
      const radOffset = (i * 120 * Math.PI) / 180;
      const traj = this.simulateSingleTrajectory(
        origin,
        angleDeg,
        v0,
        ax,
        ay,
        0,
        mobile,
        params,
        100,
        25
      );
      // Orbit modulation around apex, smoothly blooming from muzzle
      for (let j = 0; j < traj.points.length; j++) {
        const pt = traj.points[j];
        const spread = Math.min(18, pt.timeMs / 25);
        const rot = pt.timeMs / 80 + radOffset;
        pt.x += Math.cos(rot) * spread;
        pt.y += Math.sin(rot) * spread;
      }
      traj.id = `trico_${i}`;
      list.push(traj);
    }
    return list;
  }

  private static simulateBoomerShot2(
    origin: Point2D,
    angleDeg: number,
    v0: number,
    ax: number,
    ay: number,
    mobile: MobileDef,
    params: FireParams
  ): ShotTrajectory[] {
    const list: ShotTrajectory[] = [];
    for (let i = 0; i < 4; i++) {
      const traj = this.simulateSingleTrajectory(
        origin,
        angleDeg + (i - 1.5) * 1.8,
        v0 + i * 4,
        ax,
        ay,
        i * 60,
        mobile,
        params,
        120,
        25
      );
      traj.id = `boomer_2_${i}`;
      list.push(traj);
    }
    return list;
  }

  private static simulateRaonShot2(
    origin: Point2D,
    angleDeg: number,
    v0: number,
    ax: number,
    ay: number,
    mobile: MobileDef,
    params: FireParams
  ): ShotTrajectory[] {
    const traj1 = this.simulateSingleTrajectory(origin, angleDeg, v0, ax, ay, 0, mobile, params, 100, 10);
    const traj2 = this.simulateSingleTrajectory(origin, angleDeg + 3, v0 + 8, ax, ay, 90, mobile, params, 100, 10);
    traj1.subType = "raon_walker_mine";
    traj2.subType = "raon_walker_mine";
    return [traj1, traj2];
  }

  private static simulateNakShot2(
    origin: Point2D,
    angleDeg: number,
    v0: number,
    ax: number,
    ay: number,
    mobile: MobileDef,
    params: FireParams
  ): ShotTrajectory[] {
    const traj = this.simulateSingleTrajectory(origin, angleDeg, v0, ax, ay, 0, mobile, params, 250, 48);
    traj.subType = "nak_subterranean";
    return [traj];
  }

  private static simulateAdukaShot2(
    origin: Point2D,
    angleDeg: number,
    v0: number,
    ax: number,
    ay: number,
    mobile: MobileDef,
    params: FireParams
  ): ShotTrajectory[] {
    const list: ShotTrajectory[] = [];
    for (let i = 0; i < 3; i++) {
      const traj = this.simulateSingleTrajectory(
        origin,
        angleDeg + (i - 1) * 2,
        v0 + i * 5,
        ax,
        ay,
        i * 70,
        mobile,
        params,
        70,
        20
      );
      traj.subType = "aduka_thor_tracker";
      list.push(traj);
    }
    return list;
  }

  private static simulateASateShot(
    origin: Point2D,
    angleDeg: number,
    v0: number,
    ax: number,
    ay: number,
    mobile: MobileDef,
    params: FireParams
  ): ShotTrajectory[] {
    const traj = this.simulateSingleTrajectory(origin, angleDeg, v0, ax, ay, 0, mobile, params, 330, 40);
    traj.subType = "asate_ion_beacon";
    return [traj];
  }

  private static simulateKnightShot(
    origin: Point2D,
    angleDeg: number,
    v0: number,
    ax: number,
    ay: number,
    mobile: MobileDef,
    params: FireParams
  ): ShotTrajectory[] {
    const traj = this.simulateSingleTrajectory(origin, angleDeg, v0, ax, ay, 0, mobile, params, 330, 42);
    traj.subType = "knight_ion_beacon";
    return [traj];
  }

  private static simulateLightningShot(
    origin: Point2D,
    angleDeg: number,
    v0: number,
    ax: number,
    ay: number,
    mobile: MobileDef,
    params: FireParams
  ): ShotTrajectory[] {
    const traj = this.simulateSingleTrajectory(origin, angleDeg, v0, ax, ay, 0, mobile, params, 250, 38);
    traj.subType = "lightning_strike";
    return [traj];
  }
}
