/** Minimal shapes for PokéRogue runtime objects (BattleScene / Phaser). */

export interface PhaserGameLike {
  scene?: {
    getScene?: (key: string) => BattleSceneLike | undefined;
    keys?: Record<string, unknown>;
  };
  canvas?: HTMLCanvasElement;
  isRunning?: boolean;
}

export interface BattleSceneLike {
  currentBattle?: BattleLike | null;
  arena?: ArenaLike | null;
  money?: number;
  seed?: string;
  sessionSlotId?: number;
  score?: number;
  phaseManager?: {
    getCurrentPhase?: () => { constructor?: { name?: string }; isVictory?: boolean } | null;
  };
  getPlayerParty?: () => PokemonLike[];
  getEnemyParty?: () => PokemonLike[];
  getPlayerField?: (active?: boolean) => PokemonLike[];
  getEnemyField?: (active?: boolean) => PokemonLike[];
  modifiers?: ModifierLike[];
  gameData?: GameDataLike;
  gameMode?: { modeId?: number; isClassic?: boolean };
}

export interface GameDataLike {
  voucherCounts?: Record<number, number> | number[];
}

export interface ModifierLike {
  type?: { name?: string };
  stackCount?: number;
  getStackCount?: () => number;
}

export interface BattleLike {
  waveIndex?: number;
  battleType?: number;
  trainer?: TrainerLike | null;
  double?: boolean;
  isClassicFinalBoss?: boolean;
}

export interface ArenaLike {
  biomeId?: number | string;
}

export interface TrainerLike {
  trainerName?: string;
  config?: { name?: string };
}

export interface PokemonLike {
  id?: number;
  level?: number;
  name?: string;
  nickname?: string;
  species?: { speciesId?: number; name?: string };
  getSpecies?: () => { speciesId?: number; name?: string };
  getName?: () => string;
  getAbility?: () => { name?: string; id?: number };
  getMoveset?: () => Array<{ getMove?: () => { name?: string; id?: number }; moveId?: number }>;
  moveset?: Array<{ getMove?: () => { name?: string; id?: number }; moveId?: number }>;
  getHeldItems?: () => Array<{ type?: { name?: string } }>;
}

export interface GameStateSnapshot {
  timestamp: string;
  source: "battle-scene";
  runId: string;
  wave: number | null;
  biome: string | number | null;
  money: number | null;
  score: number | null;
  phase: string | null;
  trainerName: string | null;
  battleType: number | null;
  isBoss: boolean | null;
  runResultHint: "win" | "loss" | "unknown" | null;
  party: Array<{
    name: string;
    level: number | null;
    speciesId: number | null;
    ability: string | null;
    moves: string[];
    heldItems: string[];
  }>;
  enemyParty: Array<{
    name: string;
    level: number | null;
    speciesId: number | null;
    ability: string | null;
    moves: string[];
    heldItems: string[];
  }>;
  playerField: Array<{
    name: string;
    level: number | null;
    speciesId: number | null;
    ability: string | null;
    moves: string[];
    heldItems: string[];
  }>;
  enemyField: Array<{
    name: string;
    level: number | null;
    speciesId: number | null;
    ability: string | null;
    moves: string[];
    heldItems: string[];
  }>;
  modifierCount: number;
  modifierSummary: string;
  voucherTotal: number;
  voucherSummary: string;
  gameCaptured: boolean;
  battleSceneActive: boolean;
}

export interface PokerogueAnalyticsRoot {
  game?: PhaserGameLike;
  phaserHookInstalled?: boolean;
  phaserHookAt?: string;
  discovery?: unknown;
  getState?: () => GameStateSnapshot | null;
}
