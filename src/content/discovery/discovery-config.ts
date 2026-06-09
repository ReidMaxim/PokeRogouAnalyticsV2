import {
  DISCOVERY_MAX_ARRAY_ITEMS,
  DISCOVERY_MAX_CANDIDATES,
  DISCOVERY_MAX_DEPTH,
  DISCOVERY_MAX_PROPERTIES,
  DISCOVERY_MAX_STRING_LENGTH,
  KNOWN_GAME_GLOBALS,
} from "../../shared/constants";

/** Keywords used to identify game-related state objects. */
export const DISCOVERY_KEYWORDS = [
  "wave",
  "battle",
  "player",
  "pokemon",
  "money",
  "team",
  "biome",
  "arena",
  "party",
  "trainer",
  "voucher",
  "modifier",
  "phase",
  "run",
  "seed",
  "starter",
  "enemy",
  "boss",
  "shop",
  "capture",
  "gym",
  "money",
  "pokeball",
  "item",
] as const;

export type DiscoveryKeyword = (typeof DISCOVERY_KEYWORDS)[number];

/** Property names that are usually safe and informative to preview. */
export const PREVIEW_PROPERTY_NAMES = [
  "waveIndex",
  "wave",
  "currentBattle",
  "currentBattleIndex",
  "money",
  "biome",
  "arena",
  "party",
  "team",
  "player",
  "trainer",
  "trainerName",
  "enemyParty",
  "phase",
  "gameMode",
  "seed",
  "sessionId",
  "runId",
  "vouchers",
  "modifiers",
  "level",
  "species",
  "name",
] as const;

export interface DiscoveryScanOptions {
  maxDepth?: number;
  maxProperties?: number;
  maxArrayItems?: number;
  maxCandidates?: number;
  keywords?: readonly string[];
  includeWindowEnumeration?: boolean;
}

export const DEFAULT_DISCOVERY_OPTIONS: Required<DiscoveryScanOptions> = {
  maxDepth: DISCOVERY_MAX_DEPTH,
  maxProperties: DISCOVERY_MAX_PROPERTIES,
  maxArrayItems: DISCOVERY_MAX_ARRAY_ITEMS,
  maxCandidates: DISCOVERY_MAX_CANDIDATES,
  keywords: DISCOVERY_KEYWORDS,
  includeWindowEnumeration: true,
};

/** Paths that are checked before the general recursive scan. */
export const PRIORITY_PROBE_PATHS = [
  "globalScene",
  "globalScene.currentBattle",
  "globalScene.arena",
  "globalScene.party",
  "globalScene.gameMode",
  "globalScene.money",
  "globalScene.waveIndex",
  "globalScene.phaseManager",
  "globalScene.ui",
  "pokerogueApi",
] as const;

export { KNOWN_GAME_GLOBALS };
