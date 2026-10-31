import { Assets, Rectangle, Texture } from "pixi.js";
import projDefs from "./projectileDefs.json";

export interface ProjectileTextures {
  textures: Texture[];
  anchor: { x: number; y: number };
}

const MOBILE_BULLET_MAP: Record<number, string[]> = {
  0: ["armor2", "armor1", "armorss"],
  1: ["mage2a", "mage1", "magess"],
  2: ["nak2", "nak1", "nakss"],
  3: ["trico1", "trico1", "trico2"],
  4: ["bigfoot2", "bigfoot1", "bigfootss"],
  5: ["boomer12", "boomer12", "boomerss"],
  6: ["raon2", "raon1", "raonss"],
  7: ["turtle2a", "turtle1", "turtless"],
};

const MOBILE_EXPLODE_MAP: Record<number, string[]> = {
  0: ["armor2", "armor1", "armorss"],
  1: ["asate2", "mage1", "magess"],
  2: ["nak2", "nak1", "nakss"],
  3: ["trico2", "trico1", "tricoss"],
  4: ["bigfoot2", "bigfoot1ss", "bigfoot1ss"],
  5: ["boomer12", "boomer12", "boomerss"],
  6: ["raon2", "raon1", "raonss"],
  7: ["turtle2", "turtle1", "turtless"],
};

export class ProjectileSpriteManager {
  private static bulletCache: Map<string, ProjectileTextures> = new Map();
  private static explodeCache: Map<string, ProjectileTextures> = new Map();

  private static decompressGraphics(
    baseTexture: Texture,
    graphics: (number | number[])[]
  ): ProjectileTextures {
    if (!graphics || graphics.length === 0) {
      if (baseTexture.width > baseTexture.height) {
        const frameH = baseTexture.height;
        const frameW = frameH;
        const numFrames = Math.floor(baseTexture.width / frameH);
        if (numFrames > 1) {
          const textures: Texture[] = [];
          for (let i = 0; i < numFrames; i++) {
            textures.push(
              new Texture({
                source: baseTexture.source,
                frame: new Rectangle(i * frameW, 0, frameW, frameH),
              })
            );
          }
          return {
            textures,
            anchor: { x: 0.5, y: 0.5 },
          };
        }
      }
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
      const sliceX = Math.max(0, Math.min(f[4], baseTexture.width - 1));
      const w = Math.max(1, Math.min(f[0], baseTexture.width - sliceX));
      const h = Math.max(1, Math.min(f[1], baseTexture.height));
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
          frame: new Rectangle(sliceX, 0, w, h),
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
      baseTexture.source.scaleMode = "nearest";
      baseTexture.source.autoGenerateMipmaps = false;
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
      baseTexture.source.scaleMode = "nearest";
      baseTexture.source.autoGenerateMipmaps = false;
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
