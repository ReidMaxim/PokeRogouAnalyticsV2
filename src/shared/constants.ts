/** Extension-wide constants and feature flags. */

export const EXTENSION_VERSION = "3.0.0";

export const EXTENSION_NAMESPACE = "pokerogue-analytics";

export const MESSAGE_SOURCE = {
  CONTENT: `${EXTENSION_NAMESPACE}:content`,
  INJECTED: `${EXTENSION_NAMESPACE}:injected`,
  BACKGROUND: `${EXTENSION_NAMESPACE}:background`,
  POPUP: `${EXTENSION_NAMESPACE}:popup`,
} as const;

export const DOM_EVENT_CHANNEL = `${EXTENSION_NAMESPACE}:bridge`;

export const STORAGE_KEYS = {
  DISCOVERY_MODE: "discoveryModeEnabled",
  DEBUG_LOGGING: "debugLoggingEnabled",
  COLLECTION_ENABLED: "collectionEnabled",
  OVERLAY_ENABLED: "overlayEnabled",
  OVERLAY_LEFT: "overlayLeft",
  OVERLAY_TOP: "overlayTop",
  AUTO_EXPORT_ON_RUN_END: "autoExportOnRunEnd",
  AUTO_EXPORT_FORMAT: "autoExportFormat",
  BATTLE_CARDS_ENABLED: "battleCardsEnabled",
  BATTLE_CARDS_ALLIES_LEFT: "battleCardsAlliesLeft",
  BATTLE_CARDS_ALLIES_TOP: "battleCardsAlliesTop",
  BATTLE_CARDS_ALLIES_WIDTH: "battleCardsAlliesWidth",
  BATTLE_CARDS_ALLIES_HEIGHT: "battleCardsAlliesHeight",
  BATTLE_CARDS_ENEMIES_LEFT: "battleCardsEnemiesLeft",
  BATTLE_CARDS_ENEMIES_TOP: "battleCardsEnemiesTop",
  BATTLE_CARDS_ENEMIES_WIDTH: "battleCardsEnemiesWidth",
  BATTLE_CARDS_ENEMIES_HEIGHT: "battleCardsEnemiesHeight",
  // Leaderboard settings
  LEADERBOARD_ENABLED: "leaderboardEnabled",
  LEADERBOARD_URL: "leaderboardUrl",
  LEADERBOARD_USERNAME: "leaderboardUsername",
  LEADERBOARD_SECRET: "leaderboardSecret",
} as const;

/** Known PokéRogue host patterns. */
export const POKEROGUE_HOSTS = [
  "pokerogue.net",
  "pagefaultgames.github.io",
  "localhost",
  "127.0.0.1",
] as const;

/**
 * Well-known globals reported by the PokéRogue source (see globalScene).
 * Discovery still searches broadly; these are checked first.
 */
export const KNOWN_GAME_GLOBALS = [
  "globalScene",
  "globalThis",
  "Phaser",
  "pokerogueApi",
] as const;

/** Default max depth when recursively scanning objects. */
export const DISCOVERY_MAX_DEPTH = 6;

/** Default max properties scanned per object. */
export const DISCOVERY_MAX_PROPERTIES = 80;

/** Max array elements to inspect per array. */
export const DISCOVERY_MAX_ARRAY_ITEMS = 20;

/** Max string length when serializing values for logging. */
export const DISCOVERY_MAX_STRING_LENGTH = 200;

/** Max candidates reported to the console per scan. */
export const DISCOVERY_MAX_CANDIDATES = 40;
