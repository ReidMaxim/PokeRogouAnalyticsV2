import type { EvolutionEntry } from "../analytics/run-recap";

export function renderEvolutionLog(container: HTMLElement, entries: EvolutionEntry[]): void {
  if (entries.length === 0) {
    container.innerHTML = `<p class="empty-hint">No party changes logged yet.</p>`;
    return;
  }

  const rows = entries
    .map(
      (entry) => `
      <tr>
        <td>${entry.wave ?? "—"}</td>
        <td>${new Date(entry.timestamp).toLocaleTimeString()}</td>
        <td>${escapeHtml(entry.pokemon)}</td>
        <td>${escapeHtml(entry.reason)}</td>
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
          <th>Pokémon</th>
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
