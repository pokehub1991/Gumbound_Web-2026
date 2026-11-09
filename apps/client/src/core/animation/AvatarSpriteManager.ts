import { Assets, Rectangle, Texture } from "pixi.js";
import avatarDefs from "../constants/defs/avatarDefs.json";

export interface AvatarFrameInfo {
  w: number;
  h: number;
  cx: number;
  cy: number;
  x: number;
  y: number;
}

export interface AvatarTextures {
  headTextures: Texture[];
  bodyTextures: Texture[];
  headFrames: AvatarFrameInfo[];
  bodyFrames: AvatarFrameInfo[];
}

export class AvatarSpriteManager {
  private static cache: Map<string, AvatarTextures> = new Map();
  private static loadingPromises: Map<string, Promise<AvatarTextures>> = new Map();

  public static async loadAvatar(gender: "male" | "female"): Promise<AvatarTextures> {
    if (this.cache.has(gender)) {
      return this.cache.get(gender)!;
    }
    if (this.loadingPromises.has(gender)) {
      return this.loadingPromises.get(gender)!;
    }

    const promise = this.internalLoad(gender);
    this.loadingPromises.set(gender, promise);

    try {
      const textures = await promise;
      this.cache.set(gender, textures);
      return textures;
    } finally {
      this.loadingPromises.delete(gender);
    }
  }

  private static async internalLoad(gender: "male" | "female"): Promise<AvatarTextures> {
    const headKey = gender === "male" ? "mh00000" : "fh00000";
    const bodyKey = gender === "male" ? "mb00000" : "fb00000";

    const headPath = `/sprites/avatars/${headKey}.png`;
    const bodyPath = `/sprites/avatars/${bodyKey}.png`;

    const [headBase, bodyBase] = await Promise.all([
      Assets.load<Texture>(headPath),
      Assets.load<Texture>(bodyPath),
    ]);

    const headDefList = (avatarDefs as Record<string, AvatarFrameInfo[]>)[headKey] || [];
    const bodyDefList = (avatarDefs as Record<string, AvatarFrameInfo[]>)[bodyKey] || [];

    const headTextures: Texture[] = [];
    for (const f of headDefList) {
      const rect = new Rectangle(f.x, f.y, f.w, f.h);
      headTextures.push(
        new Texture({
          source: headBase.source,
          frame: rect,
        })
      );
    }

    const bodyTextures: Texture[] = [];
    for (const f of bodyDefList) {
      const rect = new Rectangle(f.x, f.y, f.w, f.h);
      bodyTextures.push(
        new Texture({
          source: bodyBase.source,
          frame: rect,
        })
      );
    }

    return {
      headTextures,
      bodyTextures,
      headFrames: headDefList,
      bodyFrames: bodyDefList,
    };
  }

  public static async preloadAll(): Promise<void> {
    await Promise.allSettled([this.loadAvatar("male"), this.loadAvatar("female")]);
  }
}

