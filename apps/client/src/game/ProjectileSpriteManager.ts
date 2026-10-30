import { Assets, Rectangle, Texture } from "pixi.js";
import projDefs from "./projectileDefs.json";

export interface ProjectileTextures {
  textures: Texture[];
  anchor: { x: number; y: number };
}

const MOBILE_BULLET_MAP: Record<number, string[]> = {
  0: ["armor1", "armor2", "armorss"],
  1: ["mage1", "mage2a", "magess"],
  2: ["nak1", "nak2", "nakss"],
  3: ["trico1", "trico1", "trico2"],
  4: ["bigfoot1", "bigfoot2", "bigfootss"],
  5: ["boomer12", "boomer12", "boomerss"],
  6: ["raon1", "raon2", "raonss"],
  7: ["turtle1", "turtle2a", "turtless"],
};

const MOBILE_EXPLODE_MAP: Record<number, string[]> = {
  0: ["armor1", "armor2", "armorss"],
  1: ["mage1", "asate2", "magess"],
  2: ["nak1", "nak2", "nakss"],
  3: ["trico1", "trico2", "tricoss"],
  4: ["bigfoot1ss", "bigfoot2", "bigfoot1ss"],
  5: ["boomer12", "boomer12", "boomerss"],
  6: ["raon1", "raon2", "raonss"],
  7: ["turtle1", "turtle2", "turtless"],
};

export class ProjectileSpriteManager {
  private static bulletCache: Map<string, ProjectileTextures> = new Map();
  private static explodeCache: Map<string, ProjectileTextures> = new Map();

  private static decompressGraphics(
    baseTexture: Texture,
    graphics: (number | number[])[]
  ): ProjectileTextures {
    if (!graphics || graphics.length === 0) {
      return {
        textures: [baseTexture],
        anchor: { x: 0.5, y: 0.5 },
      };
    }

    // Step 1: Expand repeat counts
    const expanded: number[][] = [];
    let currentFrame: number[] | null = null;

    for (let i = 0; i < graphics.length; i++) {
      const item = graphics[i];
      if (typeof item === "number") {
        if (currentFrame) {
          for (let k = 0; k < item; k++) {
            expanded.push(currentFrame);
          }
        }
      } else if (Array.isArray(item)) {
        currentFrame = item.slice();
        expanded.push(currentFrame);
      }
    }

    // Step 2: Slice textures along x axis
    let curX = 0;
    const textures: Texture[] = [];
    let anchor = { x: 0.5, y: 0.5 };

    for (let i = 0; i < expanded.length; i++) {
      const f = expanded[i];
      if (f.length < 5) {
        // [w, h, cx, cy] -> append x
        f.push(curX);
        curX += f[0] + 1;
      }
      const sliceX = f[4];
      const w = f[0];
      const h = f[1];
      const cx = f[2];
      const cy = f[3];

      if (i === 0) {
        anchor = {
          x: cx / (w || 1),
          y: cy / (h || 1),
        };
      }

      textures.push(
        new Texture({
          source: baseTexture.source,
          frame: new Rectangle(sliceX, 0, Math.min(w, baseTexture.width - sliceX), Math.min(h, baseTexture.height)),
        })
      );
    }

    return {
      textures: textures.length > 0 ? textures : [baseTexture],
      anchor,
    };
  }

  public static getCachedBullet(mobileType: number, shotType: number): ProjectileTextures | undefined {
    const list = MOBILE_BULLET_MAP[mobileType] || MOBILE_BULLET_MAP[0];
    const key = list[Math.min(shotType, list.length - 1)] || "armor1";
    return this.bulletCache.get(key);
  }

  public static getCachedExplosion(mobileType: number, shotType: number): ProjectileTextures | undefined {
    const list = MOBILE_EXPLODE_MAP[mobileType] || MOBILE_EXPLODE_MAP[0];
    const key = list[Math.min(shotType, list.length - 1)] || "armor1";
    return this.explodeCache.get(key);
  }

  public static async loadBullet(mobileType: number, shotType: number): Promise<ProjectileTextures> {
    const list = MOBILE_BULLET_MAP[mobileType] || MOBILE_BULLET_MAP[0];
    const key = list[Math.min(shotType, list.length - 1)] || "armor1";

    if (this.bulletCache.has(key)) {
      return this.bulletCache.get(key)!;
    }

    const def = (projDefs.bullets as Record<string, any>)[key] || (projDefs.bullets as Record<string, any>)["armor1"];
    const filename = def?.file ? `${def.file}.png` : "armor1.png";
    const path = `/sprites/bullets/${filename}`;

    try {
      const baseTexture: Texture = await Assets.load(path);
      const result = this.decompressGraphics(baseTexture, def?.graphics || []);
      this.bulletCache.set(key, result);
      return result;
    } catch (e) {
      console.warn(`[ProjectileSpriteManager] Could not load bullet ${key} from ${path}`, e);
      return { textures: [], anchor: { x: 0.5, y: 0.5 } };
    }
  }

  public static async loadExplosion(mobileType: number, shotType: number): Promise<ProjectileTextures> {
    const list = MOBILE_EXPLODE_MAP[mobileType] || MOBILE_EXPLODE_MAP[0];
    const key = list[Math.min(shotType, list.length - 1)] || "armor1";

    if (this.explodeCache.has(key)) {
      return this.explodeCache.get(key)!;
    }

    const def = (projDefs.explodes as Record<string, any>)[key] || (projDefs.explodes as Record<string, any>)["armor1"];
    const filename = def?.file ? `${def.file}.png` : "armor1.png";
    const path = `/sprites/explodes/${filename}`;

    try {
      const baseTexture: Texture = await Assets.load(path);
      const result = this.decompressGraphics(baseTexture, def?.graphics || []);
      this.explodeCache.set(key, result);
      return result;
    } catch (e) {
      console.warn(`[ProjectileSpriteManager] Could not load explosion ${key} from ${path}`, e);
      return { textures: [], anchor: { x: 0.5, y: 0.5 } };
    }
  }

  public static async preloadAll(): Promise<void> {
    const promises: Promise<any>[] = [];
    for (let mob = 0; mob < 8; mob++) {
      for (let shot = 0; shot < 3; shot++) {
        promises.push(this.loadBullet(mob, shot));
        promises.push(this.loadExplosion(mob, shot));
      }
    }
    await Promise.allSettled(promises);
  }
}
