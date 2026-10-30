import { Opcode, MatchStartState, TurnStartState, ProjectileResultState, MatchEndState } from "@gumbound/shared";
import { Game } from "./Game.js";
import { Connection } from "../network/Connection.js";

export class MatchController {
  private game: Game;
  private connection: Connection;
  public localUserId: string = "";
  public activeUserId: string = "";
  public turnNumber: number = 1;
  public myTeam: string = "A";
  public winnerTeam?: string;

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
    this.activeUserId = state.active_id;
    this.turnNumber = state.turn_number;

    if (state.wind) {
      this.game.windIndicator.setWind(state.wind.magnitude, state.wind.angle_deg);
    }

    const activeMobile = this.game.mobiles.get(state.active_id);
    const isMyTurn = state.active_id === this.localUserId;

    if (activeMobile) {
      this.game.camera.panTo(activeMobile.x, activeMobile.y);
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
    this.connection.send(Opcode.FIRE_SHOT, {
      angle,
      power,
      shot_type: shotType,
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
    // Fire projectile visual animation along authoritative trajectory
    this.game.fireProjectile(result.trajectory, () => {
      // On impact: carve crater into terrain
      if (result.terrain_delta) {
        this.game.terrain.clearCircle(
          result.terrain_delta.x,
          result.terrain_delta.y,
          result.terrain_delta.radius
        );
      }

      // Apply damage to mobiles
      for (const [id, dmg] of Object.entries(result.damages || {})) {
        const mob = this.game.mobiles.get(id);
        if (mob) {
          mob.setHp(mob.hp - dmg);
        }
      }
    });
  }

  public setShotType(type: number) {
    this.game.aimController.shotType = type;
  }
}

