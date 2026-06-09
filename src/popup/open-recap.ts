export function getRecapPageUrl(runId?: string | null): string {
  const url = new URL(chrome.runtime.getURL("recap.html"));
  if (runId) {
    url.searchParams.set("runId", runId);
  }
  return url.toString();
}

export function openRecapPage(runId?: string): void {
  void chrome.tabs.create({ url: getRecapPageUrl(runId) });
}

export async function copyRecapLink(runId?: string | null): Promise<void> {
  await navigator.clipboard.writeText(getRecapPageUrl(runId));
}

export async function copyRunSummaryText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
