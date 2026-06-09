import type { BiomeJourneyEntry } from "../analytics/run-recap";

export function renderBiomeJourney(container: HTMLElement, entries: BiomeJourneyEntry[]): void {
  if (entries.length === 0) {
    container.innerHTML = `<p class="empty-hint">No biome changes logged yet.</p>`;
    return;
  }

  const rows = entries
    .map((entry) => {
      const waveRange =
        entry.fromWave != null && entry.toWave != null && entry.fromWave !== entry.toWave
          ? `Waves ${entry.fromWave}–${entry.toWave}`
          : entry.fromWave != null
            ? `Wave ${entry.fromWave}`
            : "—";
      return `
        <tr>
          <td>${escapeHtml(entry.biome)}</td>
          <td>${waveRange}</td>
        </tr>
      `;
    })
    .join("");

  container.innerHTML = `
    <table class="journey-table">
      <thead>
        <tr>
          <th>Biome</th>
          <th>Waves</th>
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
