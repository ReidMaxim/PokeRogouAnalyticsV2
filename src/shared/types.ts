/** Shared message types for extension communication. */

export type ExtensionMessageType =
  | "DISCOVERY_RUN"
  | "DISCOVERY_RESULT"
  | "DISCOVERY_TOGGLE"
  | "GET_SETTINGS"
  | "SETTINGS_UPDATED"
  | "SETTINGS_SYNC"
  | "GET_GAME_STATE"
  | "GAME_STATE_RESULT"
  | "COLLECTOR_LOG"
  | "SAVE_RUN_LOG"
  | "EXPORT_LOGS_JSON"
  | "EXPORT_LOGS_CSV"
  | "EXPORT_RUNS_CSV"
  | "EXPORT_RUN_JSON"
  | "EXPORT_RUN_CSV"
  | "EXPORT_PINNED_JSON"
  | "EXPORT_PINNED_CSV"
  | "EXPORT_OUTCOME_JSON"
  | "EXPORT_OUTCOME_CSV"
  | "SET_RUNS_PINNED"
  | "EXPORT_ACTIVE_JSON"
  | "EXPORT_ACTIVE_CSV"
  | "EXPORT_RUNS_BY_ID_JSON"
  | "EXPORT_RUNS_BY_ID_CSV"
  | "DELETE_RUNS"
  | "IMPORT_BACKUP_JSON"
  | "DELETE_UNPINNED_RUNS"
  | "CLEAR_ALL_DATA"
  | "DELETE_RUN"
  | "PIN_RUN"
  | "SET_RUN_NOTE"
  | "GET_DASHBOARD_STATS"
  | "GET_CROSS_RUN_ANALYTICS"
  | "GET_RUN_SUMMARIES"
  | "GET_RUN_RECAP"
  | "LIST_RECAP_RUNS"
  | "ENRICH_BATTLE_SPECIES"
  | "GET_POKEDEX_PROGRESS"
  | "GET_SPECIES_DETAIL"
  | "REBUILD_POKEDEX_PROGRESS"
  | "DEBUG_LOG"
  | "PING";

export interface ExtensionMessage<T = unknown> {
  source: string;
  type: ExtensionMessageType;
  payload?: T;
  requestId?: string;
}

export interface DiscoveryCandidate {
  path: string;
  score: number;
  matchedKeywords: string[];
  type: string;
  preview: Record<string, unknown>;
  sampleValues: Record<string, unknown>;
}

export interface GameStateSnapshotSummary {
  timestamp: string;
  source: string;
  runId: string;
  wave: number | null;
  biome: string | number | null;
  money: number | null;
  score: number | null;
  phase: string | null;
  trainerName: string | null;
  party: Array<{ name: string; level: number | null; speciesId: number | null }>;
  enemyParty: Array<{ name: string; level: number | null; speciesId: number | null }>;
  gameCaptured: boolean;
  battleSceneActive: boolean;
}

export interface DiscoveryReport {
  timestamp: string;
  url: string;
  durationMs: number;
  windowKeys: string[];
  knownGlobals: Array<{
    name: string;
    found: boolean;
    type: string;
    preview?: Record<string, unknown>;
  }>;
  candidates: DiscoveryCandidate[];
  notes: string[];
  gameState?: GameStateSnapshotSummary | null;
}

export type AutoExportFormat = "csv" | "json" | "both";

export interface ExtensionSettings {
  discoveryModeEnabled: boolean;
  debugLoggingEnabled: boolean;
  collectionEnabled: boolean;
  overlayEnabled: boolean;
  overlayLeft: number | null;
  overlayTop: number | null;
  battleCardsEnabled: boolean;
  battleCardsAlliesLeft: number | null;
  battleCardsAlliesTop: number | null;
  battleCardsAlliesWidth: number | null;
  battleCardsAlliesHeight: number | null;
  battleCardsEnemiesLeft: number | null;
  battleCardsEnemiesTop: number | null;
  battleCardsEnemiesWidth: number | null;
  battleCardsEnemiesHeight: number | null;
  autoExportOnRunEnd: boolean;
  autoExportFormat: AutoExportFormat;
  // Leaderboard opt-in settings
  leaderboardEnabled: boolean;
  leaderboardUrl: string | null;
  leaderboardUsername: string | null;
  leaderboardSecret: string | null;
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  discoveryModeEnabled: false,
  debugLoggingEnabled: true,
  collectionEnabled: true,
  overlayEnabled: false,
  overlayLeft: null,
  overlayTop: null,
  battleCardsEnabled: true,
  battleCardsAlliesLeft: null,
  battleCardsAlliesTop: null,
  battleCardsAlliesWidth: null,
  battleCardsAlliesHeight: null,
  battleCardsEnemiesLeft: null,
  battleCardsEnemiesTop: null,
  battleCardsEnemiesWidth: null,
  battleCardsEnemiesHeight: null,
  autoExportOnRunEnd: false,
  autoExportFormat: "csv",
  // leaderboard defaults
  leaderboardEnabled: false,
  leaderboardUrl: null,
  leaderboardUsername: null,
  leaderboardSecret: null,
};
