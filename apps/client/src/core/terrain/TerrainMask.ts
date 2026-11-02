export interface SlopeInfo {
  groundY: number;
  angle: number; // in radians
  angleDeg: number; // in degrees
  dy: number;
}

export interface WalkResult {
  x: number;
  y: number;
  stuck: boolean;
  isAirborne?: boolean;
  fallAndDie: boolean;
}

export class TerrainMask {
  public width: number;
  public height: number;
  public maskData: Uint8ClampedArray;

  constructor(width: number, height: number, maskData?: Uint8ClampedArray) {
    this.width = width;
    this.height = height;
    this.maskData = maskData || new Uint8ClampedArray(width * height * 4);
  }

  public isPixelSolid(x: number, y: number): boolean {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) return false;
    const index = (iy * this.width + ix) * 4 + 3; // Alpha channel
    return this.maskData[index] > 64;
  }

  /**
   * Finds the ground contact Y for column x (the air pixel immediately above solid terrain).
   * Matches DragonBound surface convention: IsPixel(x, y) == false && IsPixel(x, y + 1) == true.
   */
  public findSurfaceY(x: number, startY: number): number {
    const ix = Math.floor(x);
    if (ix < 0 || ix >= this.width) return startY;

    const sy = Math.floor(startY);

    // If already inside solid ground, scan upward to find the true surface air pixel
    if (this.isPixelSolid(ix, sy)) {
      for (let y = sy; y >= 0; y--) {
        if (!this.isPixelSolid(ix, y)) {
          return y;
        }
      }
      return sy;
    }

    // Starting in air: scan downwards to find first solid pixel; return the air pixel (y - 1)
    for (let y = Math.max(0, sy); y < this.height; y++) {
      if (this.isPixelSolid(ix, y)) {
        return y - 1;
      }
    }

    // No ground exists below (abyss / bunge)
    return this.height + 200;
  }

  public getUnder(x: number, y: number, maxDepth: number = 25): number | undefined {
    const ix = Math.floor(x);
    if (ix < 0 || ix >= this.width) return undefined;
    const sy = Math.floor(y);
    const limit = Math.min(this.height, sy + maxDepth);
    for (let cy = sy; cy < limit; cy++) {
      if (this.isPixelSolid(ix, cy)) {
        return cy - 1;
      }
    }
    return undefined;
  }

  /**
   * Scans downwards from the top of the map (y=0) to find the absolute topmost solid ground pixel.
   */
  public getFirstSolidY(x: number): number | null {
    const ix = Math.floor(x);
    if (ix < 0 || ix >= this.width) return null;
    for (let y = 0; y < this.height; y++) {
      if (this.isPixelSolid(ix, y)) {
        return y - 1;
      }
    }
    return null;
  }

  /**
   * Finds a safe, playable ground coordinate on top of the terrain surface.
   */
  public getRandomGroundPosition(minX: number = 200, maxX: number = this.width - 200): { x: number; y: number } {
    for (let attempts = 0; attempts < 150; attempts++) {
      const randX = Math.floor(minX + Math.random() * (maxX - minX));
      const groundY = this.getFirstSolidY(randX);
      if (groundY !== null && groundY < this.height - 40) {
        const slope = this.getSlopeAngle(randX, groundY);
        // Ensure reasonable slope, not vertical cliff or dropoff
        if (Math.abs(slope.angleDeg) < 60) {
          return { x: randX, y: groundY };
        }
      }
    }
    // Fallback safe position
    return { x: Math.floor((minX + maxX) / 2), y: 492 };
  }

  /**
   * Authentic DragonBound 19-pixel slope sampling algorithm (GetAngle):
   * Samples up to 9 pixels left and 9 pixels right.
   */
  public getSlopeAngle(x: number, y: number): SlopeInfo {
    const groundY = this.findSurfaceY(x, y);

    let sumLeft = groundY;
    let countLeft = 1;
    let sumRight = groundY;
    let countRight = 1;

    for (let k = 1; k <= 9; k++) {
      const uL = this.getUnder(x - k, groundY - 5, 25);
      if (uL !== undefined) {
        sumLeft += uL;
        countLeft++;
      }
      const uR = this.getUnder(x + k, groundY - 5, 25);
      if (uR !== undefined) {
        sumRight += uR;
        countRight++;
      }
    }

    const avgLeft = sumLeft / countLeft;
    const avgRight = sumRight / countRight;
    const dy = avgRight - avgLeft;
    const rad = Math.atan2(dy, 19);
    const angleDeg = (rad * 180) / Math.PI;

    return {
      groundY,
      angle: rad,
      angleDeg,
      dy,
    };
  }

  /**
   * Authentic DragonBound walking physics (GetPosForWalking):
   * Moves left (dir < 0) or right (dir > 0) by 1 step.
   * Can climb up to 12 pixels uphill.
   * Walks down slopes (<= 8px drop per step directly).
   * Over cliffs or abyss (drop > 8px or void): advances X horizontally so mobile never gets stuck,
   * while CombatArena gravity smoothly accelerates the tank downward into the crater/abyss.
   */
  public walk(x: number, y: number, dir: number): WalkResult {
    const targetX = dir < 0 ? Math.floor(x - 1) : Math.floor(x + 1);
    if (targetX < 0 || targetX >= this.width) {
      return { x, y, stuck: true, fallAndDie: false };
    }

    const currentY = Math.floor(y);

    // 1. Destination pixel at currentY is solid ground (Uphill):
    if (this.isPixelSolid(targetX, currentY)) {
      // DragonBound: scan upwards up to 12 pixels to find walkable air
      for (let stepY = currentY; stepY > currentY - 12; stepY--) {
        if (!this.isPixelSolid(targetX, stepY)) {
          return { x: targetX, y: stepY, stuck: false, fallAndDie: false };
        }
      }
      // Wall steeper than 12 pixels: blocked/stuck
      return { x, y, stuck: true, fallAndDie: false };
    }

    // 2. Destination pixel is air (Downhill / Flat / Slope / Cliff):
    // Check gentle downhill slope (up to 8 pixels down per horizontal step)
    for (let fallY = currentY + 1; fallY <= currentY + 8; fallY++) {
      if (this.isPixelSolid(targetX, fallY)) {
        return { x: targetX, y: fallY - 1, stuck: false, fallAndDie: false };
      }
    }

    // 3. Ground drops more than 8px below (Cliff / Crater / Abyss / Void):
    // In GunBound/DragonBound, the tank advances X horizontally off the ledge,
    // and CombatArena gravity physics smoothly handles the descent!
    let hasGroundBelow = false;
    for (let testY = currentY + 9; testY < this.height; testY++) {
      if (this.isPixelSolid(targetX, testY)) {
        hasGroundBelow = true;
        break;
      }
    }

    return {
      x: targetX,
      y: currentY,
      stuck: false,
      isAirborne: true,
      fallAndDie: !hasGroundBelow,
    };
  }

  /**
   * Elliptical crater excavation matching AddGroundHole.
   */
  public carveHole(xc: number, yc: number, rx: number, ry: number) {
    const m = rx * rx;
    const n = ry * ry;

    const minX = Math.max(0, Math.floor(xc - rx - 2));
    const maxX = Math.min(this.width - 1, Math.ceil(xc + rx + 2));
    const minY = Math.max(0, Math.floor(yc - ry - 2));
    const maxY = Math.min(this.height - 1, Math.ceil(yc + ry + 2));

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const dx = x - xc;
        const dy = y - yc;
        if ((dx * dx) / m + (dy * dy) / n < 1.0) {
          const index = (y * this.width + x) * 4 + 3;
          this.maskData[index] = 0; // Clear alpha -> air
        }
      }
    }
  }
}
