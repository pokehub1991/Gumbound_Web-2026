import { Opcode, MatchStartState, TurnStartState, ProjectileResultState, MatchEndState } from "@gumbound/shared";
import { Game } from "./Game.js";
import { Connection } from "../network/Connection.js";
import { ProjectileSpriteManager } from "./ProjectileSpriteManager.js";

export class MatchController {
  private game: Game;
  private connection: Connection;
  public localUserId: string = "";
  public activeUserId: string = "";
  public turnNumber: number = 1;
  public myTeam: string = "A";
  public winnerTeam?: string;
  private pendingTurnState?: TurnStartState;

  public onTurnChange?: (activeNick: string, isMyTurn: boolean, turnNum: number) => void;
  public onMatchEnd?: (winnerTeam: string) => void;

  constructor(game: Game, connection: Connection) {
    this.game = game;
    this.connection = connection;

    this.setupNetworkHandlers();

    // When player fires via spacebar
    this.game.aimController.onFireCallback = (angle, power, shotType) => {
      this.handleLocalFire(angle, power, shotType);
    };

    // When player moves along terrain
    this.game.aimController.onMoveCallback = (x, y, facing) => {
      this.handleLocalMove(x, y, facing);
    };

    // Preload authentic bullet and explosion sprites
    ProjectileSpriteManager.preloadAll();
  }

  private setupNetworkHandlers() {
    this.connection.handler.on(Opcode.MATCH_START, (msg) => {
      const state = msg.json<MatchStartState>();
      this.handleMatchStart(state);
    });

    this.connection.handler.on(Opcode.TURN_START, (msg) => {
      const state = msg.json<TurnStartState>();
      this.handleTurnStart(state);
    });

    this.connection.handler.on(Opcode.PROJECTILE_RESULT, (msg) => {
      const result = msg.json<ProjectileResultState>();
      this.handleProjectileResult(result);
    });

    this.connection.handler.on(Opcode.PLAYER_MOVE, (msg) => {
      const p = msg.json<{ player_id: string; x: number; y: number; facing: number }>();
      if (p.player_id !== this.localUserId) {
        const mob = this.game.mobiles.get(p.player_id);
        if (mob) {
          mob.x = p.x;
          mob.y = p.y;
          mob.setFacing(p.facing);
          const slope = this.game.terrain.getSlopeAngle(p.x, p.y);
          mob.setTilt(slope.angle);
        }
      }
    });

    this.connection.handler.on(Opcode.MATCH_END, (msg) => {
      const state = msg.json<MatchEndState>();
      this.winnerTeam = state.winner_team;
      if (this.onMatchEnd) {
        this.onMatchEnd(state.winner_team);
      }
    });
  }

  private handleMatchStart(state: MatchStartState) {
    // Clear existing mobiles
    this.game.mobiles.forEach((m) => {
      this.game.mobilesContainer.removeChild(m);
    });
    this.game.mobiles.clear();

    // Spawn mobiles
    state.players.forEach((p) => {
      const mobile = this.game.addMobile({
        id: p.id,
        nickname: p.nickname,
        team: p.team,
        mobileType: p.mobile_id,
        maxHp: p.max_hp,
        hp: p.hp,
        x: p.pos.x,
        y: p.pos.y,
      });

      // Align to terrain slope
      const defaultFacing = p.team === "B" ? -1 : 1;
      mobile.setFacing(defaultFacing);
      const slope = this.game.terrain.getSlopeAngle(mobile.x, mobile.y);
      mobile.y = slope.groundY;
      mobile.setTilt(slope.angle);

      if (p.id === this.localUserId) {
        this.myTeam = p.team;
        // Camera centers on local player
        this.game.camera.panTo(mobile.x, mobile.y);
      }
    });

    // Set initial wind
    if (state.wind) {
      this.game.windIndicator.setWind(state.wind.magnitude, state.wind.angle_deg);
    }
  }

  private handleTurnStart(state: TurnStartState) {
    // If a projectile is currently active/exploding, defer turn start until explosion finishes
    if (this.game.activeProjectile) {
      this.pendingTurnState = state;
      return;
    }

    this.activeUserId = state.active_id;
    this.turnNumber = state.turn_number;

    if (state.wind) {
      this.game.windIndicator.setWind(state.wind.magnitude, state.wind.angle_deg);
    }

    const activeMobile = this.game.mobiles.get(state.active_id) || Array.from(this.game.mobiles.values())[0];
    const isMyTurn = state.active_id === this.localUserId || this.game.mobiles.size === 1;

    if (activeMobile) {
      activeMobile.playAnimation("normal");
      this.game.camera.panTo(activeMobile.x, activeMobile.y - 30);
      if (isMyTurn) {
        this.game.aimController.enabled = true;
        this.game.aimController.setActiveMobile(activeMobile);
      } else {
        this.game.aimController.enabled = false;
        this.game.aimController.setActiveMobile(undefined);
      }

      if (this.onTurnChange) {
        this.onTurnChange(activeMobile.nickname, isMyTurn, this.turnNumber);
      }
    }
  }

  private handleLocalFire(angle: number, power: number, shotType: number) {
    const activeMob = this.game.mobiles.get(this.localUserId);
    const facing = activeMob ? activeMob.facing : 1;
    this.connection.send(Opcode.FIRE_SHOT, {
      angle,
      power,
      shot_type: shotType,
      facing,
    });
  }

  private handleLocalMove(x: number, y: number, facing: number) {
    this.connection.send(Opcode.PLAYER_MOVE, {
      x,
      y,
      facing,
    });
  }

  private handleProjectileResult(result: ProjectileResultState) {
    const shooter = this.game.mobiles.get(this.activeUserId);
    const mobileType = shooter ? shooter.mobileType : 0;
    const shotType = this.game.aimController.shotType;

    // Trigger authentic recoil/fire animation on shooter mobile
    if (shooter) {
      const fireAnim = shotType === 2 ? "sfire" : shotType === 1 ? "fire2" : "fire1";
      shooter.playAnimation(fireAnim, false);
    }

    // Fire authentic projectile animation with bullet & explosion sprites (camera tracks projectile)
    this.game.fireProjectile(
      result.trajectory,
      mobileType,
      shotType,
      () => {
        // On impact: carve crater into terrain
        if (result.terrain_delta) {
          this.game.terrain.clearCircle(
            result.terrain_delta.x,
            result.terrain_delta.y,
            result.terrain_delta.radius
          );

          // Re-align and tilt all mobiles to updated ground terrain
          this.game.mobiles.forEach((m) => {
            const slope = this.game.terrain.getSlopeAngle(m.x, m.y);
            m.y = slope.groundY;
            m.setTilt(slope.angle);
          });
        }

        // Apply damage to mobiles
        for (const [id, dmg] of Object.entries(result.damages || {})) {
          const mob = this.game.mobiles.get(id);
          if (mob) {
            mob.setHp(mob.hp - dmg);
          }
        }
      },
      () => {
        // Explosion finished: return camera and idle animation to active mobile
        const activeMob = this.game.mobiles.get(this.activeUserId) || Array.from(this.game.mobiles.values())[0];
        if (activeMob) {
          activeMob.playAnimation("normal");
          this.game.camera.panTo(activeMob.x, activeMob.y - 30);
        }

        // Apply deferred turn state or re-enable turn for solo practice testing
        if (this.pendingTurnState) {
          const nextState = this.pendingTurnState;
          this.pendingTurnState = undefined;
          this.handleTurnStart(nextState);
        } else if (this.activeUserId === this.localUserId || this.game.mobiles.size === 1) {
          this.game.aimController.enabled = true;
          if (activeMob) {
            this.game.aimController.setActiveMobile(activeMob);
            if (this.onTurnChange) {
              this.onTurnChange(activeMob.nickname, true, this.turnNumber);
            }
          }
        }
      }
    );
  }

  public setShotType(type: number) {
    this.game.aimController.shotType = type;
  }
}

