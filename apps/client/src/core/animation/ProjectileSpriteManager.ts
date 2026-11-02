import { Assets, Rectangle, Texture } from "pixi.js";
import projDefs from "../constants/defs/projectileDefs.json";

export interface ProjectileTextures {
  textures: Texture[];
  anchor: { x: number; y: number };
  isProcedural?: boolean;
}

export const CANONICAL_BULLET_MAP: Record<number, string[]> = {
  0: ["armor1", "armor2", "armorss"],
  1: ["ice1", "ice2", "icess"],
  2: ["aduka1", "aduka2", "adukass"],
  3: ["lightning12", "lightning12", "lightningss"],
  4: ["bigfoot1", "bigfoot2", "bigfootss"],
  5: ["jd1", "jd2", "jdss"],
  6: ["asate1", "asate2", "asatess"],
  7: ["armor1", "armor2", "armorss"],
  8: ["knight1", "knight2", "knightss"],
  9: ["fox1", "fox2", "foxss"],
  10: ["dragon1", "dragon2_ss", "dragon2_ss_ion"],
  11: ["nak1", "nak2", "nakss"],
  12: ["trico1", "trico1", "trico2"],
  13: ["mage1", "mage2a", "magess"],
  14: ["turtle1", "turtle2a", "turtless"],
  15: ["boomer12", "boomer12", "boomerss"],
  16: ["lightning12", "lightning12", "trico2"],
  17: ["grub1", "grub2", "grubss"],
  18: ["dragon1", "dragon2_ss", "dragon2_ss_ion"],
  19: ["raon1", "raon2", "raonss"],
  20: ["armor1", "armor2", "armorss"],
  21: ["frog12", "frog12", "frogss"],
  22: ["kalsiddon1_tiny", "kalsiddon2_tiny", "kalsiddonss_tiny"],
  23: ["armor1", "armor2", "armorss"],
  24: ["dragon1", "dragon2_ss", "dragon2_ss_ion"],
  25: ["armor1", "armor2", "armorss"],
};

export const CANONICAL_EXPLODE_MAP: Record<number, string[]> = {
  0: ["armor1", "armor2", "armorss"],
  1: ["ice1", "ice2", "icess"],
  2: ["aduka1_thor", "aduka1_thor", "aduka1_thor"],
  3: ["lightining12_jd1", "lightining12_jd1", "lightningss"],
  4: ["bigfoot1ss", "bigfoot2", "bigfoot1ss"],
  5: ["lightining12_jd1", "jd2", "jdss"],
  6: ["asate1", "asate2", "asatess"],
  7: ["armor1", "armor2", "armorss"],
  8: ["knight", "knight", "knight"],
  9: ["fox1", "fox2", "foxss"],
  10: ["dragon1", "dragon2", "dragonss"],
  11: ["nak1", "nak2", "nakss"],
  12: ["trico1", "trico2", "tricoss"],
  13: ["mage1", "asate2", "magess"],
  14: ["turtle1", "turtle2", "turtless"],
  15: ["boomer12", "boomer12", "boomerss"],
  16: ["electric", "electric", "electric"],
  17: ["grub1", "grub2", "grubss"],
  18: ["dragon1", "dragon2", "dragonss"],
  19: ["raon1", "raon2", "raonss"],
  20: ["armor1", "armor2", "armorss"],
  21: ["mage1", "grub2", "grubss"],
  22: ["bigfoot2", "bigfoot2", "bigfoot1ss"],
  23: ["armor1", "armor2", "armorss"],
  24: ["dragon1", "dragon2", "dragonss"],
  25: ["armor1", "armor2", "armorss"],
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

    const textures: Texture[] = [];
    let c = 0;
    const frameH = baseTexture.height;
    let avgAnchorX = 0.5;
    let avgAnchorY = 0.5;

    for (let i = 0; i < rawList.length; i++) {
      const f = rawList[i];
      const w = f[0];
      const cx = f[2];
      const cy = f[3];

      // In GunBound / DragonBound spritesheets, every frame has a 1-pixel separator (c += w + 1)
      // The full frame height in the PNG strip is baseTexture.height, preventing horizontal cutoff
      const rect = new Rectangle(c, 0, w, frameH);
      c += w + 1;

      if (rect.x + rect.width > baseTexture.width) {
        rect.width = Math.max(0, baseTexture.width - rect.x);
      }
      if (rect.width <= 0) continue;

      const anchorX = w > 0 ? cx / w : 0.5;
      const anchorY = frameH > 0 ? cy / frameH : 0.5;

      const frameTexture = new Texture({
        source: baseTexture.source,
        frame: rect,
        defaultAnchor: {
          x: anchorX,
          y: anchorY,
        },
      });

      textures.push(frameTexture);

      if (i === 0) {
        avgAnchorX = anchorX;
        avgAnchorY = anchorY;
      }
    }

    if (textures.length === 0) {
      textures.push(baseTexture);
    }

    return {
      textures,
      anchor: { x: avgAnchorX, y: avgAnchorY },
    };
  }

  public static async loadBulletByKey(key: string): Promise<ProjectileTextures> {
    if (this.bulletCache.has(key)) {
      return this.bulletCache.get(key)!;
    }

    const defs = projDefs.bullets as Record<string, { file: string; graphics?: (number | number[])[] }>;
    const def = defs[key];
    const filename = def ? def.file : key;
    const cleanFilename = filename.replace(/\.png$/i, "");

    try {
      const baseTexture = await Assets.load<Texture>(`/sprites/bullets/${cleanFilename}.png`);
      const result = this.decompressGraphics(baseTexture, def?.graphics || []);
      this.bulletCache.set(key, result);
      return result;
    } catch {
      const fallback = Texture.WHITE;
      const result = { textures: [fallback], anchor: { x: 0.5, y: 0.5 } };
      this.bulletCache.set(key, result);
      return result;
    }
  }

  public static async loadBullet(mobileType: number, shotType: number): Promise<ProjectileTextures> {
    const list = CANONICAL_BULLET_MAP[mobileType] || ["armor1", "armor2", "armorss"];
    const key = list[Math.min(shotType, list.length - 1)];
    return this.loadBulletByKey(key);
  }

  public static async loadExplosion(mobileType: number, shotType: number): Promise<ProjectileTextures> {
    const list = CANONICAL_EXPLODE_MAP[mobileType] || ["armor1", "armor2", "armorss"];
    const key = list[Math.min(shotType, list.length - 1)];

    if (this.explodeCache.has(key)) {
      return this.explodeCache.get(key)!;
    }

    const defs = projDefs.explodes as Record<string, { file: string; graphics?: (number | number[])[] }>;
    const def = defs[key];
    const filename = def ? def.file : key;
    const cleanFilename = filename.replace(/\.png$/i, "");

    try {
      const baseTexture = await Assets.load<Texture>(`/sprites/explodes/${cleanFilename}.png`);
      const result = this.decompressGraphics(baseTexture, def?.graphics || []);
      this.explodeCache.set(key, result);
      return result;
    } catch {
      const fallback = Texture.WHITE;
      const result = { textures: [fallback], anchor: { x: 0.5, y: 0.5 } };
      this.explodeCache.set(key, result);
      return result;
    }
  }

  public static loadBulletTextures(mobileType: number, shotType: number): Promise<ProjectileTextures> {
    return this.loadBullet(mobileType, shotType);
  }

  public static loadExplosionTextures(mobileType: number, shotType: number): Promise<ProjectileTextures> {
    return this.loadExplosion(mobileType, shotType);
  }

  public static getCachedBullet(mobileType: number, shotType: number): ProjectileTextures | undefined {
    const list = CANONICAL_BULLET_MAP[mobileType] || ["armor1", "armor2", "armorss"];
    const key = list[Math.min(shotType, list.length - 1)];
    return this.bulletCache.get(key);
  }

  public static getCachedExplosion(mobileType: number, shotType: number): ProjectileTextures | undefined {
    const list = CANONICAL_EXPLODE_MAP[mobileType] || ["armor1", "armor2", "armorss"];
    const key = list[Math.min(shotType, list.length - 1)];
    return this.explodeCache.get(key);
  }

  public static async preloadAll(): Promise<void> {
    const bulletKeys = Object.keys(projDefs.bullets);
    const explodeKeys = Object.keys(projDefs.explodes);

    await Promise.allSettled([
      ...bulletKeys.map((k) => {
        const def = (projDefs.bullets as Record<string, { file: string }>)[k];
        return Assets.load(`/sprites/bullets/${def.file}.png`);
      }),
      ...explodeKeys.map((k) => {
        const def = (projDefs.explodes as Record<string, { file: string }>)[k];
        return Assets.load(`/sprites/explodes/${def.file}.png`);
      }),
    ]);
  }
}
