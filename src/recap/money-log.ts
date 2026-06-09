import type { MoneyChangeEntry } from "../analytics/run-recap";

export function renderMoneyChangeLog(container: HTMLElement, entries: MoneyChangeEntry[]): void {
  if (entries.length === 0) {
    container.innerHTML = `<p class="empty-hint">No money changes logged yet.</p>`;
    return;
  }

  const rows = entries
    .map(
      (entry) => `
      <tr>
        <td>${entry.wave ?? "—"}</td>
        <td>${new Date(entry.timestamp).toLocaleTimeString()}</td>
        <td>${entry.money ?? "—"}</td>
        <td>${escapeHtml(entry.label)}</td>
      </tr>
    `,
    )
    .join("");

  container.innerHTML = `
    <table class="journey-table">
      <thead>
        <tr>
          <th>Wave</th>
          <th>Time</th>
          <th>Money</th>
          <th>Change</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
