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
    // Sky above bridge deck is strictly non-solid (prevents ghost mid-air collisions on sky shots)
    if (iy < 475) return false;
    const index = (iy * this.width + ix) * 4 + 3; // Alpha channel
    return this.maskData[index] > 64;
  }

  public findSurfaceY(x: number, startY: number): number {
    const ix = Math.floor(x);
    if (ix < 0 || ix >= this.width) return startY;

    // Scan vertically around current Y
    const minY = Math.max(0, Math.floor(startY - 50));
    const maxY = Math.min(this.height - 1, Math.floor(startY + 80));

    // If already inside solid ground, scan upward for surface
    if (this.isPixelSolid(ix, startY)) {
      for (let y = Math.floor(startY); y >= minY; y--) {
        if (!this.isPixelSolid(ix, y)) {
          return y + 1;
        }
      }
      return minY;
    }

    // Otherwise scan downward for first solid pixel
    for (let y = Math.floor(startY); y <= maxY; y++) {
      if (this.isPixelSolid(ix, y)) {
        return y;
      }
    }

    return startY;
  }

  /**
   * Scans downwards from the top of the map (y=0) to find the absolute topmost solid ground pixel.
   */
  public getFirstSolidY(x: number): number | null {
    const ix = Math.floor(x);
    if (ix < 0 || ix >= this.width) return null;
    for (let y = 0; y < this.height; y++) {
      if (this.isPixelSolid(ix, y)) {
        return y;
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
   * Authentic DragonBound 19-pixel slope sampling algorithm.
   */
  public getSlopeAngle(x: number, y: number): SlopeInfo {
    const currentY = this.findSurfaceY(x, y);

    let sumLeft = currentY;
    let countLeft = 1;
    let sumRight = currentY;
    let countRight = 1;

    for (let k = 1; k <= 9; k++) {
      const yL = this.findSurfaceY(x - k, currentY);
      sumLeft += yL;
      countLeft++;

      const yR = this.findSurfaceY(x + k, currentY);
      sumRight += yR;
      countRight++;
    }

    const avgLeft = sumLeft / countLeft;
    const avgRight = sumRight / countRight;
    const dy = avgRight - avgLeft;
    const rad = Math.atan2(dy, 19);
    const angleDeg = (rad * 180) / Math.PI;

    return {
      groundY: currentY,
      angle: rad,
      angleDeg,
      dy,
    };
  }

  /**
   * Authentic DragonBound walking physics (GetPosForWalking):
   * Moves left (dir < 0) or right (dir > 0) by 1 step.
   * Can climb up to 10 pixels uphill.
   * Falls downward until solid ground is hit.
   */
  public walk(x: number, y: number, dir: number): WalkResult {
    const targetX = dir < 0 ? Math.floor(x - 1) : Math.floor(x + 1);
    if (targetX < 0 || targetX >= this.width) {
      return { x, y, stuck: true, fallAndDie: false };
    }

    // If destination pixel is solid ground (Uphill):
    if (this.isPixelSolid(targetX, y)) {
      // Check if it can climb up to 10 pixels of slope
      for (let stepY = y; stepY >= y - 10; stepY--) {
        if (!this.isPixelSolid(targetX, stepY)) {
          return { x: targetX, y: stepY, stuck: false, fallAndDie: false };
        }
      }
      // Wall too steep: stuck
      return { x, y, stuck: true, fallAndDie: false };
    }

    // If destination pixel is air (Downhill or flat):
    // Only walk downward if the drop is gentle (<= 4 pixels per horizontal step)
    for (let fallY = y; fallY <= y + 4; fallY++) {
      if (this.isPixelSolid(targetX, fallY)) {
        return { x: targetX, y: fallY - 1, stuck: false, fallAndDie: false };
      }
    }

    // Ground drops more than 4px below (Cliff / Crater / Airborne):
    // Advance X horizontally, but do NOT snap Y down. CombatArena gravity physics smoothly handles the descent!
    return { x: targetX, y, stuck: false, fallAndDie: false };
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
