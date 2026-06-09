import type { ExtensionMessage } from "../shared/types";
import { MESSAGE_SOURCE } from "../shared/constants";

export async function sendTabMessage<T>(message: ExtensionMessage): Promise<T> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("No active tab found");
  }

  try {
    return (await chrome.tabs.sendMessage(tab.id, message)) as T;
  } catch {
    throw new Error(
      "Could not reach the PokéRogue tab. Open pokerogue.net, reload the tab, then try again.",
    );
  }
}

export async function syncActiveTabSettings(settings: unknown): Promise<void> {
  await sendTabMessage({
    source: MESSAGE_SOURCE.POPUP,
    type: "SETTINGS_SYNC",
    payload: settings,
  });
}
