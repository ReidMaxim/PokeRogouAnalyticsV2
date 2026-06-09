export function parseModifierSummary(summary: string | null | undefined): string[] {
  if (!summary?.trim()) {
    return [];
  }
  return summary.split("|").map((part) => part.trim()).filter(Boolean);
}

export function formatModifierListText(modifiers: string[], max = 8): string {
  if (modifiers.length === 0) {
    return "";
  }
  const shown = modifiers.slice(0, max);
  const suffix = modifiers.length > max ? ` (+${modifiers.length - max} more)` : "";
  return `${shown.join(", ")}${suffix}`;
}

export function renderModifierListHtml(modifiers: string[]): string {
  if (modifiers.length === 0) {
    return `<p class="empty-hint">No run modifiers logged yet.</p>`;
  }

  return `<ul class="modifiers-list">${modifiers
    .map((modifier) => `<li>${escapeHtml(modifier)}</li>`)
    .join("")}</ul>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
