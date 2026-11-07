import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { ActiveWeatherColumn, WeatherType } from "./WeatherManager.js";

const WEATHER_COLORS: Partial<Record<WeatherType, { fill: string; border: number; glow: string }>> = {
  sun: { fill: "#facc15", border: 0xfacc15, glow: "rgba(250, 204, 21, 0.7)" },
  lightning: { fill: "#67e8f9", border: 0x38bdf8, glow: "rgba(103, 232, 249, 0.7)" },
  tornado: { fill: "#38bdf8", border: 0x38bdf8, glow: "rgba(56, 189, 248, 0.7)" },
  mirror: { fill: "#fb923c", border: 0xfb923c, glow: "rgba(251, 146, 60, 0.7)" },
  black: { fill: "#c084fc", border: 0xc084fc, glow: "rgba(192, 132, 252, 0.7)" },
};

const WEATHER_TITLES: Partial<Record<WeatherType, string>> = {
  sun: "SOL / FUERZA",
  lightning: "RAYO",
  tornado: "TORNADO",
  mirror: "ESPEJO",
  black: "ECLIPSE",
};

/**
 * WeatherSkyMarker
 * 
 * Screen-space indicator pinned to the TOP EDGE of the user's monitor.
 * Always stays visible at the top edge of the viewport even when the camera pans or zooms,
 * tracking the horizontal screen position of the active weather column below it.
 */
export class WeatherSkyMarker extends Container {
  private badgeContainer: Container;
  private backgroundGraphic: Graphics;
  private pointerGraphic: Graphics;
  private titleText: Text;
  private time: number = 0;
  private currentType?: WeatherType;
  private currentY: number = 22;

  constructor() {
    super();

    this.visible = false;
    this.badgeContainer = new Container();
    this.addChild(this.badgeContainer);

    this.backgroundGraphic = new Graphics();
    this.badgeContainer.addChild(this.backgroundGraphic);

    this.pointerGraphic = new Graphics();
    this.badgeContainer.addChild(this.pointerGraphic);

    const style = new TextStyle({
      fontFamily: ["Silkscreen", "sans-serif"],
      fontSize: 10,
      fontWeight: "900",
      fill: "#ffffff",
      stroke: { color: "#000000", width: 3 },
      dropShadow: {
        alpha: 0.9,
        angle: Math.PI / 2,
        blur: 2,
        color: "#000000",
        distance: 2,
      },
    });

    this.titleText = new Text({ text: "CLIMA", style });
    this.titleText.anchor.set(0.5, 0.5);
    this.badgeContainer.addChild(this.titleText);
  }

  public update(
    dt: number,
    cameraX: number,
    cameraZoom: number,
    screenW: number,
    activeColumn: ActiveWeatherColumn | null
  ) {
    if (!activeColumn) {
      this.visible = false;
      return;
    }

    this.visible = true;
    this.time += dt * 0.05;

    // Convert world X of weather column to Screen Space X
    const rawScreenX = (activeColumn.x - cameraX) * cameraZoom + screenW / 2;

    // Clamp inside screen horizontal boundaries so it never clips off monitor
    const minX = 75;
    const maxX = screenW - 75;
    const clampedX = Math.max(minX, Math.min(maxX, rawScreenX));

    // Exact top HUD obstacle avoidance:
    // Center HUD (Clima + Wind) accurately spans from [screenW/2 - 235] to [screenW/2 + 115] (~405px to 755px at 1280w)
    // Left controls (Zoom & map) span from 0 to 215px; Right HUD (turn list/timer) spans from (screenW - 370px) to screenW
    const isUnderCenterHud = clampedX > (screenW / 2 - 235) && clampedX < (screenW / 2 + 115);
    const isUnderLeftHud = clampedX < 215;
    const isUnderRightHud = clampedX > (screenW - 370);
    const isUnderAnyHud = isUnderCenterHud || isUnderLeftHud || isUnderRightHud;

    // In open sky, badge sits sleekly right at monitor top edge (22px); under widgets, drops to 56px
    const targetBaseY = isUnderAnyHud ? 56 : 22;
    // Rapid, responsive lerp so the badge rises and drops without lag
    this.currentY += (targetBaseY - this.currentY) * 0.28;
    const bob = Math.sin(this.time * 3) * 1.5;
    this.x = clampedX;
    this.y = this.currentY + bob;

    // Direction indicators if column is off-screen
    let prefix = "▼ ";
    let suffix = " ▼";
    if (rawScreenX < minX) {
      prefix = "◀ ";
      suffix = "";
    } else if (rawScreenX > maxX) {
      prefix = "";
      suffix = " ▶";
    }

    const type = activeColumn.type;
    const name = WEATHER_TITLES[type] || activeColumn.name || "CLIMA";
    const fullText = `${prefix}${name}${suffix}`;

    if (this.titleText.text !== fullText || this.currentType !== type) {
      this.currentType = type;
      this.titleText.text = fullText;

      const conf = WEATHER_COLORS[type] || { fill: "#38bdf8", border: 0x38bdf8 };
      this.titleText.style.fill = conf.fill;

      // Redraw sleek pixel badge
      const padX = 10;
      const w = this.titleText.width + padX * 2;
      const h = 18;

      this.backgroundGraphic.clear();
      // Outer drop shadow
      this.backgroundGraphic.roundRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2, 4).fill({ color: 0x000000, alpha: 0.85 });
      // Inner dark metallic body
      this.backgroundGraphic.roundRect(-w / 2, -h / 2, w, h, 3).fill({ color: 0x090f1e, alpha: 0.95 });
      // Glowing border
      this.backgroundGraphic.roundRect(-w / 2, -h / 2, w, h, 3).stroke({ width: 1.5, color: conf.border, alpha: 0.9 });

      // Downward pointer arrow
      this.pointerGraphic.clear();
      this.pointerGraphic.poly([
        -4, h / 2,
        4, h / 2,
        0, h / 2 + 5,
      ]).fill({ color: conf.border, alpha: 0.95 });
    }
  }

  public cleanup() {
    this.titleText.destroy();
    this.backgroundGraphic.destroy();
    this.pointerGraphic.destroy();
    this.destroy({ children: true });
  }
}
