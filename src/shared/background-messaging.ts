import { MESSAGE_SOURCE } from "./constants";
import type { ExtensionMessage } from "./types";

export async function sendBackgroundMessage<T = unknown>(
  type: ExtensionMessage["type"],
  payload?: unknown,
): Promise<T> {
  const response = await chrome.runtime.sendMessage({
    source: MESSAGE_SOURCE.POPUP,
    type,
    payload,
  } satisfies ExtensionMessage);

  if (response === undefined) {
    throw new Error("Background not responding — reload the extension at chrome://extensions");
  }

  if (response && typeof response === "object" && "ok" in response && response.ok === false) {
    throw new Error(String((response as { error?: string }).error ?? "Background request failed"));
  }

  if (response && typeof response === "object" && "error" in response && response.error) {
    throw new Error(String(response.error));
  }

  return response as T;
}
