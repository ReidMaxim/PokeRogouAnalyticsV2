export function getDexPageUrl(): string {
  return chrome.runtime.getURL("dex.html");
}

export function openDexPage(): void {
  void chrome.tabs.create({ url: getDexPageUrl() });
}
