import { Assets, Texture } from "pixi.js";
import { AvatarSlotKey, AvatarEquipment } from "../constants/avatarSlots.js";

export class AvatarAssetManager {
  private static textureCache: Map<string, Texture> = new Map();
  private static loadingPromises: Map<string, Promise<Texture | null>> = new Map();

  /**
   * Resolves the asset path for an avatar item ID.
   * Default items live in /sprites/avatars/default/<id>.png.
   * Full URLs or paths starting with "/" are preserved.
   */
  public static resolveItemPath(itemId: string): string {
    if (itemId.startsWith("/") || itemId.startsWith("http://") || itemId.startsWith("https://")) {
      return itemId;
    }
    return `/sprites/avatars/default/${itemId}.png`;
  }

  /**
   * Loads and caches an avatar item texture with pixel-art nearest filtering.
   */
  public static async loadItemTexture(itemId: string): Promise<Texture | null> {
    if (!itemId) return null;

    if (this.textureCache.has(itemId)) {
      return this.textureCache.get(itemId)!;
    }

    if (this.loadingPromises.has(itemId)) {
      return this.loadingPromises.get(itemId)!;
    }

    const loadPromise = (async () => {
      try {
        const path = this.resolveItemPath(itemId);
        const texture = await Assets.load<Texture>(path);
        if (texture?.source) {
          texture.source.scaleMode = "nearest";
        }
        this.textureCache.set(itemId, texture);
        return texture;
      } catch (err) {
        console.warn(`[AvatarAssetManager] Failed to load avatar texture "${itemId}":`, err);
        return null;
      } finally {
        this.loadingPromises.delete(itemId);
      }
    })();

    this.loadingPromises.set(itemId, loadPromise);
    return loadPromise;
  }

  /**
   * Preloads all default equipment textures including eyes open and closed.
   */
  public static async preloadDefaults(): Promise<void> {
    const itemsToPreload = new Set<string>([
      "face_default",
      "face_turn",
      "eyes_open",
      "eyes_closed",
      "body_default",
      "face_female",
      "face_turn_female",
      "eyes_open_female",
      "eyes_closed_female",
      "body_female",
      "helmet_default",
      "hairback_default",
      "flag_default",
      "pet_default",
    ]);

    await Promise.all(
      Array.from(itemsToPreload).map((itemId) => this.loadItemTexture(itemId))
    );
  }

  /**
   * Loads all textures for an avatar equipment set.
   */
  public static async loadEquipment(
    equipment: AvatarEquipment
  ): Promise<Partial<Record<AvatarSlotKey, Texture>>> {
    const result: Partial<Record<AvatarSlotKey, Texture>> = {};
    const slots = Object.keys(equipment) as AvatarSlotKey[];

    await Promise.all(
      slots.map(async (slot) => {
        const itemId = equipment[slot];
        if (itemId) {
          const tex = await this.loadItemTexture(itemId);
          if (tex) result[slot] = tex;
        }
      })
    );

    return result;
  }
}
