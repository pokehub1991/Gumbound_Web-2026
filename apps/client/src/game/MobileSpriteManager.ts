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
};

export class MobileSpriteManager {
  private static cache: Map<number, MobileAnimationTextures> = new Map();
  private static loadingPromises: Map<number, Promise<MobileAnimationTextures>> = new Map();

  /**
   * Authentic DragonBound / GunBound EPA frame decompression algorithm.
   * Expands run-length counts while keeping duplicate frames pointing
   * to their exact texture coordinates on the spritesheet.
   */
  public static decompressFrames(anim: { g: (number | number[])[]; x?: number; y?: number }): FrameData[] {
    if (!anim || !anim.g || !Array.isArray(anim.g)) return [];

    // Step 1: Expand RLE counts into frame reference array
    const decompressed: number[][] = [];
    let currentFrame: number[] | null = null;

    for (let i = 0; i < anim.g.length; i++) {
      const item = anim.g[i];
      if (typeof item === "number") {
        if (currentFrame) {
          for (let k = 0; k < item; k++) {
            decompressed.push(currentFrame);
          }
        }
      } else if (Array.isArray(item)) {
        currentFrame = item.slice();
        decompressed.push(currentFrame);
      }
    }

    // Step 2: Assign sprite sheet coordinates (curX, curY)
    // Only unique frames advance curX (x position on spritesheet)
    let curX = anim.x || 0;
    const curY = anim.y || 0;
    const result: FrameData[] = [];

    for (let i = 0; i < decompressed.length; i++) {
      const f = decompressed[i];
      if (f.length < 8) {
        f.push(curX, curY);
        curX += f[0] + 1;
      }
      result.push({
        w: f[0],
        h: f[1],
        cx: f[2],
        cy: f[3],
        ox: f[4],
        oy: f[5],
        x: f[6],
        y: f[7],
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

      const sliceTextures = (frames: FrameData[]): Texture[] => {
        return frames.map((f) => {
          return new Texture({
            source: baseTexture.source,
            frame: new Rectangle(f.x, f.y, f.w, f.h),
          });
        });
      };

      const animations: Record<string, Texture[]> = {};
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
        primaryAnchor,
      };

      this.cache.set(mobileType, result);
      return result;
    })();

    this.loadingPromises.set(mobileType, promise);
    return promise;
  }
}
