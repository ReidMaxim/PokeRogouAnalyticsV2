/**
 * Runs at document_start in the page MAIN world.
 * Must not import chrome.* APIs.
 */

import { DOM_EVENT_CHANNEL, EXTENSION_VERSION, MESSAGE_SOURCE } from "../../shared/constants";
import { createLogger } from "../../shared/logger";
import type { DiscoveryReport, ExtensionMessage, ExtensionSettings } from "../../shared/types";
import { buildGameStateSnapshot, installStateDebugTools } from "../game-access/battle-scene-access";
import { getCapturedGame, installEarlyPhaserHook } from "../game-access/phaser-hook";
import { RunStateCollector } from "../collectors/run-state-collector";
import {
  GameStateDiscovery,
  installDiscoveryDebugTools,
  runGameStateDiscovery,
} from "../discovery/game-state-discovery";

const logger = createLogger("page-hook");

declare global {
  interface Window {
    __POKEROGUE_ANALYTICS_PAGE_HOOK__?: boolean;
  }
}

const collector = new RunStateCollector((entry) => {
  postToContentScript({
    source: MESSAGE_SOURCE.INJECTED,
    type: "COLLECTOR_LOG",
    payload: entry,
  });
});

let settings: ExtensionSettings = {
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
};

if (!window.__POKEROGUE_ANALYTICS_PAGE_HOOK__) {
  window.__POKEROGUE_ANALYTICS_PAGE_HOOK__ = true;
  bootstrap();
}

function bootstrap(): void {
  const legacyInjected = (window as unknown as Record<string, unknown>).__POKEROGUE_ANALYTICS_INJECTED__;
  if (legacyInjected) {
    console.warn(
      `%c[PokéRogue Analytics v${EXTENSION_VERSION}] Legacy injected.js is still active in this tab. Close ALL pokerogue.net tabs and open a fresh one.`,
      "color:#fdd663;font-weight:bold",
    );
  }

  logger.info(`Page hook v${EXTENSION_VERSION} initialized at document_start`);
  installEarlyPhaserHook();
  installStateDebugTools();
  installDiscoveryDebugTools();

  window.addEventListener(DOM_EVENT_CHANNEL, (event) => {
    handleMessage((event as CustomEvent<ExtensionMessage>).detail);
  });

  postToContentScript({
    source: MESSAGE_SOURCE.INJECTED,
    type: "DEBUG_LOG",
    payload: { message: "Page hook ready (document_start)" },
  });

  logger.info("Page hook initialized at document_start");
}

function applySettings(next: Partial<ExtensionSettings>): void {
  settings = { ...settings, ...next };
  logger.setDebugEnabled(settings.debugLoggingEnabled);
  collector.setEnabled(settings.collectionEnabled);

  if (settings.discoveryModeEnabled) {
    window.setTimeout(() => {
      try {
        runGameStateDiscovery();
      } catch (error) {
        logger.error("Auto discovery scan failed", error);
      }
    }, 3000);
  }
}

function handleMessage(message: ExtensionMessage | undefined): void {
  if (!message || message.source !== MESSAGE_SOURCE.CONTENT) {
    return;
  }

  switch (message.type) {
    case "DISCOVERY_RUN": {
      try {
        const report = runGameStateDiscovery();
        postToContentScript({
          source: MESSAGE_SOURCE.INJECTED,
          type: "DISCOVERY_RESULT",
          payload: report,
          requestId: message.requestId,
        });
      } catch (error) {
        logger.error("Discovery run failed", error);
        postToContentScript({
          source: MESSAGE_SOURCE.INJECTED,
          type: "DISCOVERY_RESULT",
          payload: {
            timestamp: new Date().toISOString(),
            url: window.location.href,
            durationMs: 0,
            windowKeys: [],
            knownGlobals: [],
            candidates: [],
            notes: [`Discovery failed: ${String(error)}`],
            gameState: buildGameStateSnapshot(),
          },
          requestId: message.requestId,
        });
      }
      break;
    }
    case "GET_GAME_STATE": {
      postToContentScript({
        source: MESSAGE_SOURCE.INJECTED,
        type: "GAME_STATE_RESULT",
        payload: buildGameStateSnapshot(),
        requestId: message.requestId,
      });
      break;
    }
    case "SETTINGS_SYNC": {
      applySettings((message.payload ?? {}) as Partial<ExtensionSettings>);
      postToContentScript({
        source: MESSAGE_SOURCE.INJECTED,
        type: "PING",
        payload: {
          ok: true,
          context: "page",
          gameCaptured: Boolean(getCapturedGame()),
          state: buildGameStateSnapshot(),
        },
        requestId: message.requestId,
      });
      break;
    }
    case "PING": {
      postToContentScript({
        source: MESSAGE_SOURCE.INJECTED,
        type: "PING",
        payload: {
          ok: true,
          context: "page",
          gameCaptured: Boolean(getCapturedGame()),
          state: buildGameStateSnapshot(),
        },
        requestId: message.requestId,
      });
      break;
    }
    default:
      logger.debug("Unhandled content message", message.type);
  }
}

function postToContentScript(message: ExtensionMessage): void {
  window.dispatchEvent(new CustomEvent(DOM_EVENT_CHANNEL, { detail: message }));
}

export type { DiscoveryReport, GameStateDiscovery };
