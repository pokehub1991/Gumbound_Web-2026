import { Assets, Rectangle, Texture } from "pixi.js";
import spriteDefs from "../constants/defs/mobileSpriteDefs.json";

export interface FrameData {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  ox: number;
  oy: number;
}

export interface MobileAnimationTextures {
  animations: Record<string, Texture[]>;
  anchors: Record<string, { x: number; y: number }>;
  primaryAnchor: { x: number; y: number };
}

export const CANONICAL_MOBILE_KEYS: Record<number, string> = {
  0: "armor",
  1: "ice",
  2: "aduka",
  3: "lightning",
  4: "bigfoot",
  5: "jd",
  6: "asate",
  7: "random",
  8: "knight",
  9: "fox",
  10: "dragon",
  11: "nak",
  12: "trico",
  13: "mage",
  14: "turtle",
  15: "boomer",
  17: "grub",
  19: "raon",
  21: "frog",
  22: "kalsiddon",
  23: "maya",
  24: "phoenix",
};

export class MobileSpriteManager {
  private static cache: Map<number, MobileAnimationTextures> = new Map();
  private static loadingPromises: Map<number, Promise<MobileAnimationTextures>> = new Map();

  public static decompressFrames(anim: { g: (number | number[])[]; x?: number; y?: number }): FrameData[] {
    if (!anim || !anim.g || !Array.isArray(anim.g)) return [];

    const rawList: number[][] = [];
    let template: number[] | null = null;

    for (let i = 0; i < anim.g.length; i++) {
      let item = anim.g[i];
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

    let c = anim.x || 0;
    const d = anim.y || 0;
    const result: FrameData[] = [];

    for (let i = 0; i < rawList.length; i++) {
      const f = rawList[i];
      let frameX: number;
      let frameY: number;

      if (f.length < 7) {
        frameX = c;
        frameY = d;
        c += f[0] + 1;
      } else {
        frameX = f[6];
        frameY = f[7];
      }

      result.push({
        w: f[0],
        h: f[1],
        cx: f[2],
        cy: f[3],
        ox: f[4] ?? 0,
        oy: f[5] ?? 0,
        x: frameX,
        y: frameY,
      });
    }

    return result;
  }

  public static async loadMobileTextures(mobileType: number): Promise<MobileAnimationTextures> {
    if (this.cache.has(mobileType)) {
      return this.cache.get(mobileType)!;
    }

    if (this.loadingPromises.has(mobileType)) {
      return this.loadingPromises.get(mobileType)!;
    }

    const loadPromise = this.internalLoad(mobileType);
    this.loadingPromises.set(mobileType, loadPromise);

    try {
      const textures = await loadPromise;
      this.cache.set(mobileType, textures);
      return textures;
    } finally {
      this.loadingPromises.delete(mobileType);
    }
  }

  private static async internalLoad(mobileType: number): Promise<MobileAnimationTextures> {
    const key = CANONICAL_MOBILE_KEYS[mobileType] || "armor";
    const def = (spriteDefs as Record<string, unknown>)[key] as Record<string, unknown>;

    if (!def) {
      throw new Error(`Mobile definition not found for key: ${key}`);
    }

    const filename = (def.file as string) || "Armor2D";
    const imagePath = `/sprites/mobiles/${filename}.png`;

    const baseTexture = await Assets.load<Texture>(imagePath);

    const animations: Record<string, Texture[]> = {};
    const anchors: Record<string, { x: number; y: number }> = {};
    let primaryAnchor = { x: 0.5, y: 0.9 };

    const stateKeys = Object.keys(def).filter((k) => k !== "file");

    for (const animName of stateKeys) {
      const animData = def[animName] as { g?: (number | number[])[]; d?: string; x?: number; y?: number };
      if (!animData) continue;

      if (animData.d && def[animData.d]) {
        continue;
      }

      if (!animData.g) continue;

      const frames = this.decompressFrames(animData as { g: (number | number[])[]; x?: number; y?: number });
      if (frames.length === 0) continue;

      const textures: Texture[] = [];
      let avgAnchorX = 0.5;
      let avgAnchorY = 0.9;

      for (let i = 0; i < frames.length; i++) {
        const f = frames[i];
        const rect = new Rectangle(f.x, f.y, f.w, f.h);
        const anchorX = f.w > 0 ? f.cx / f.w : 0.5;
        const anchorY = f.h > 0 ? f.cy / f.h : 0.9;

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

      animations[animName] = textures;
      anchors[animName] = { x: avgAnchorX, y: avgAnchorY };

      if (animName === "normal") {
        primaryAnchor = { x: avgAnchorX, y: avgAnchorY };
      }
    }

    // Resolve aliases (like "fire2: { d: 'fire1' }", chained aliases, etc.)
    let resolvedAny = true;
    while (resolvedAny) {
      resolvedAny = false;
      for (const animName of stateKeys) {
        if (animations[animName]) continue;
        const animData = def[animName] as { d?: string };
        if (animData && animData.d && animations[animData.d]) {
          animations[animName] = animations[animData.d];
          anchors[animName] = anchors[animData.d];
          resolvedAny = true;
        }
      }
    }

    return {
      animations,
      anchors,
      primaryAnchor,
    };
  }

  public static async preloadAll(): Promise<void> {
    const keys = Object.keys(CANONICAL_MOBILE_KEYS).map(Number);
    await Promise.allSettled(keys.map((k) => this.loadMobileTextures(k)));
  }
}
