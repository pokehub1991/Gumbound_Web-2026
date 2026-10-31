import { Assets, Rectangle, Texture } from "pixi.js";
import projDefs from "./projectileDefs.json";

export interface ProjectileTextures {
  textures: Texture[];
  anchor: { x: number; y: number };
  isStream?: boolean;
  trace?: number;
  traceH?: number;
  traceY?: number;
  baseTexture?: Texture;
}

const MOBILE_BULLET_MAP: Record<number, string[]> = {
  // MobileType.ARMOR = 0 -> Tiro 1: armor1.png, Tiro 2: armor2.png, SS: armorSS.png
  0: ["armor1", "armor2", "armorss"],
  // MobileType.MAGE = 1 -> Tiro 1: mage1.png, Tiro 2: mage2a.png, SS: mageSS.png
  1: ["mage1", "mage2a", "magess"],
  // MobileType.NAK = 2 -> Tiro 1: nak1b.png, Tiro 2: nak2b.png, SS: nakss.png
  2: ["nak1", "nak2", "nakss"],
  // MobileType.TRICO = 3 -> Tiro 1: trico.png, Tiro 2: trico.png (3 cabbage), SS: tricoSS.png
  3: ["trico1", "trico1", "trico2"],
  // MobileType.BIG_FOOT = 4 -> Tiro 1: bigfoot1b.png, Tiro 2: bigfoot2.png, SS: bigfootSSb.png
  4: ["bigfoot1", "bigfoot2", "bigfootss"],
  // MobileType.BOOMER = 5 -> Tiro 1: boomer12.png, Tiro 2: boomer12.png, SS: boomerSS.png
  5: ["boomer12", "boomer12", "boomerss"],
  // MobileType.RAON = 6 -> Tiro 1: raon1.png, Tiro 2: raon2.png, SS: raonSS.png
  6: ["raon1", "raon2", "raonss"],
  // MobileType.TURTLE = 7 -> Tiro 1: turtle12a.png, Tiro 2: turtle12a.png, SS: turtleSSclose.png
  7: ["turtle1", "turtle2a", "turtless"],
};

const MOBILE_EXPLODE_MAP: Record<number, string[]> = {
  // MobileType.ARMOR = 0
  0: ["armor1", "armor2", "armorss"],
  // MobileType.MAGE = 1
  1: ["mage1", "asate2", "magess"],
  // MobileType.NAK = 2
  2: ["nak1", "nak2", "nakss"],
  // MobileType.TRICO = 3
  3: ["armor1", "armor1", "armorss"],
  // MobileType.BIG_FOOT = 4
  4: ["bigfoot1ss", "bigfoot2", "bigfoot1ss"],
  // MobileType.BOOMER = 5
  5: ["boomer12", "boomer12", "boomerss"],
  // MobileType.RAON = 6
  6: ["raon1", "raon2", "raonss"],
  // MobileType.TURTLE = 7
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
      if (baseTexture.width > baseTexture.height) {
        const frameH = baseTexture.height;
        let frameW = frameH;
        let numFrames = Math.floor(baseTexture.width / frameH);

        // Special handling for nak1b.png (207x20 -> 9 frames of 23x20)
        if (baseTexture.width === 207 && baseTexture.height === 20) {
          frameW = 23;
          numFrames = 9;
        }

        if (numFrames > 1) {
          const textures: Texture[] = [];
          for (let i = 0; i < numFrames; i++) {
            textures.push(
              new Texture({
                source: baseTexture.source,
                frame: new Rectangle(i * frameW, 0, frameW, frameH),
                defaultAnchor: { x: 0.5, y: 0.5 },
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
    const rawList: number[][] = [];
    let template: number[] | null = null;

    for (let i = 0; i < graphics.length; i++) {
      let item = graphics[i];
      if (typeof item === "number") {
        if (template) {
          for (; 0 < item; item--) {
            rawList.push(template.slice());
          }
        }
      } else if (Array.isArray(item)) {
        template = item;
        rawList.push(item.slice());
      }
    }

    // Step 2: Slice textures along x axis with frame-accurate anchors
    let curX = 0;
    const curY = 0;
    const textures: Texture[] = [];
    let firstAnchor = { x: 0.5, y: 0.5 };

    for (let i = 0; i < rawList.length; i++) {
      const f = rawList[i];
      const w = f[0];
      const h = f[1];
      const cx = f.length > 2 ? f[2] : Math.floor(w / 2);
      const cy = f.length > 3 ? f[3] : Math.floor(h / 2);

      let sliceX = curX;
      let sliceY = curY;
      if (f.length >= 8) {
        sliceX = f[6];
        sliceY = f[7];
      } else {
        curX += w + 1;
      }

      const clampedX = Math.max(0, Math.min(sliceX, baseTexture.width - 1));
      const clampedY = Math.max(0, Math.min(sliceY, baseTexture.height - 1));
      const clampedW = Math.max(1, Math.min(w, baseTexture.width - clampedX));
      const clampedH = Math.max(1, Math.min(h, baseTexture.height - clampedY));

      const frameAnchor = {
        x: Math.max(0, Math.min(1, cx / (clampedW || 1))),
        y: Math.max(0, Math.min(1, cy / (clampedH || 1))),
      };

      if (i === 0) {
        firstAnchor = frameAnchor;
      }

      textures.push(
        new Texture({
          source: baseTexture.source,
          frame: new Rectangle(clampedX, clampedY, clampedW, clampedH),
          defaultAnchor: frameAnchor,
        })
      );
    }

    return {
      textures: textures.length > 0 ? textures : [baseTexture],
      anchor: firstAnchor,
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

      let result: ProjectileTextures;
      if (def?.isStream) {
        result = {
          textures: [baseTexture],
          anchor: { x: 0, y: 0.5 },
          isStream: true,
          trace: def.trace || 8,
          traceH: def.traceH || baseTexture.height,
          traceY: def.traceY || 0,
          baseTexture: baseTexture,
        };
      } else {
        result = this.decompressGraphics(baseTexture, def?.graphics || []);
      }
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
