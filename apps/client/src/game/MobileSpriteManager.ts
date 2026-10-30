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

  public static decompressFrames(anim: { g: (number | number[])[]; x?: number; y?: number }): FrameData[] {
    if (!anim || !anim.g) return [];
    const raw: number[][] = [];
    for (let i = 0; i < anim.g.length; i++) {
      const item = anim.g[i];
      if (typeof item === "number") {
        const prev = raw[raw.length - 1];
        if (prev) {
          for (let k = 0; k < item; k++) raw.push(prev);
        }
      } else {
        raw.push(item as number[]);
      }
    }

    let c = anim.x || 0;
    const d = anim.y || 0;
    return raw.map((f) => {
      const frame: FrameData = {
        w: f[0],
        h: f[1],
        cx: f[2],
        cy: f[3],
        ox: f[4],
        oy: f[5],
        x: c,
        y: d,
      };
      c += f[0] + 1;
      return frame;
    });
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
        "fire1",
        "fire2",
        "sfire",
        "fdamage",
        "bdamage",
        "drop",
        "dead",
        "emotion1",
      ];

      for (const state of knownStates) {
        if (def && def[state]) {
          const frames = this.decompressFrames(def[state]);
          if (frames.length > 0) {
            animations[state] = sliceTextures(frames);
          }
        }
      }

      // Default normal state
      if (!animations["normal"] || animations["normal"].length === 0) {
        animations["normal"] = [baseTexture];
      }
      if (!animations["move"]) {
        animations["move"] = animations["normal"];
      }

      const firstNormal = def?.normal ? this.decompressFrames(def.normal)[0] : undefined;
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
