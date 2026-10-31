import { Assets, Rectangle, Texture } from "pixi.js";
import spriteDefs from "./mobileSpriteDefs.json";

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

const MOBILE_KEYS: Record<number, string> = {
  0: "armor",
  1: "mage",
  2: "nak",
  3: "trico",
  4: "bigfoot",
  5: "boomer",
  6: "raon",
  7: "turtle",
  8: "lightning",
  9: "jd",
  10: "asate",
  11: "phoenix",
  12: "maya",
  13: "ice",
  14: "grub",
  15: "dragon",
  16: "knight",
  17: "aduka",
  18: "frog",
  19: "kalsiddon",
  20: "copyloid",
};

export class MobileSpriteManager {
  private static cache: Map<number, MobileAnimationTextures> = new Map();
  private static loadingPromises: Map<number, Promise<MobileAnimationTextures>> = new Map();

  /**
   * Authentic DragonBound / GunBound EPA frame decompression algorithm.
   * Decompresses repeat counts while accurately advancing the spritesheet coordinates (c, d)
   * for each distinct frame along the row.
   */
  public static decompressFrames(anim: { g: (number | number[])[]; x?: number; y?: number }): FrameData[] {
    if (!anim || !anim.g || !Array.isArray(anim.g)) return [];

    // Step 1: Decompress repeat counts (clone template so each frame independently holds coordinates)
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

    // Step 2: Assign spritesheet coordinates (c, d) sequentially along the row
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

  /**
   * Resolves an animation state including alias pointers (e.g. { d: "bfire1" })
   */
  public static resolveAnimDef(def: any, state: string, visited: Set<string> = new Set()): any {
    if (!def || !state || visited.has(state)) return null;
    visited.add(state);
    const target = def[state];
    if (!target) return null;
    if (target.g && Array.isArray(target.g)) {
      return target;
    }
    if (target.d && typeof target.d === "string") {
      return this.resolveAnimDef(def, target.d, visited);
    }
    return null;
  }

  public static async loadMobileTextures(mobileType: number): Promise<MobileAnimationTextures> {
    if (this.cache.has(mobileType)) {
      return this.cache.get(mobileType)!;
    }

    if (this.loadingPromises.has(mobileType)) {
      return this.loadingPromises.get(mobileType)!;
    }

    const promise = (async () => {
      const key = MOBILE_KEYS[mobileType] || "armor";
      const def = (spriteDefs as Record<string, any>)[key];
      const filename = def?.file ? `${def.file}.png` : "Armor2D.png";
      const spritePath = `/sprites/mobiles/${filename}`;

      const baseTexture: Texture = await Assets.load(spritePath);
      baseTexture.source.scaleMode = "nearest";
      baseTexture.source.autoGenerateMipmaps = false;

      const sliceTextures = (frames: FrameData[]): Texture[] => {
        return frames.map((f) => {
          const sliceX = Math.max(0, Math.min(f.x, baseTexture.width - 1));
          const sliceY = Math.max(0, Math.min(f.y, baseTexture.height - 1));
          const sliceW = Math.max(1, Math.min(f.w, baseTexture.width - sliceX));
          const sliceH = Math.max(1, Math.min(f.h, baseTexture.height - sliceY));
          return new Texture({
            source: baseTexture.source,
            frame: new Rectangle(sliceX, sliceY, sliceW, sliceH),
            defaultAnchor: {
              x: (f.cx || sliceW / 2) / (sliceW || 1),
              y: (f.cy || sliceH) / (sliceH || 1),
            },
          });
        });
      };

      const animations: Record<string, Texture[]> = {};
      const anchors: Record<string, { x: number; y: number }> = {};
      const knownStates = [
        "normal",
        "move",
        "wnormal",
        "wmove",
        "unmove",
        "bfire1",
        "bfire2",
        "bifire",
        "bsfire",
        "fire1",
        "fire2",
        "ifire",
        "sfire",
        "fdamage",
        "bdamage",
        "drop",
        "dead",
        "item",
        "shock",
        "ice",
        "emotion1",
      ];

      for (const state of knownStates) {
        const animDef = this.resolveAnimDef(def, state);
        if (animDef) {
          const frames = this.decompressFrames(animDef);
          if (frames.length > 0) {
            animations[state] = sliceTextures(frames);
            const f0 = frames[0];
            anchors[state] = {
              x: (f0.cx || f0.w / 2) / (f0.w || 1),
              y: (f0.cy || f0.h) / (f0.h || 1),
            };
          }
        }
      }

      // Authentic fallbacks
      if (!animations["normal"] || animations["normal"].length === 0) {
        animations["normal"] = [baseTexture];
      }
      if (!animations["move"]) {
        animations["move"] = animations["normal"];
      }
      if (!animations["bfire1"]) {
        animations["bfire1"] = animations["normal"];
      }
      if (!animations["bfire2"]) {
        animations["bfire2"] = animations["bfire1"];
      }
      if (!animations["bsfire"]) {
        animations["bsfire"] = animations["bfire1"];
      }

      const normalDef = this.resolveAnimDef(def, "normal");
      const firstNormal = normalDef ? this.decompressFrames(normalDef)[0] : undefined;
      const first = firstNormal || { w: 40, h: 40, cx: 20, cy: 35 };
      const primaryAnchor = {
        x: first.cx / first.w,
        y: first.cy / first.h,
      };

      const result: MobileAnimationTextures = {
        animations,
        anchors,
        primaryAnchor,
      };

      this.cache.set(mobileType, result);
      return result;
    })();

    this.loadingPromises.set(mobileType, promise);
    return promise;
  }
}
