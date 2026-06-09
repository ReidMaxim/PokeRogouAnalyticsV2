import type { BiomeStat } from "../analytics/cross-run-analytics";

const HEAT_COLORS = ["#334155", "#7c2d12", "#c2410c", "#ea580c", "#f97316", "#fb923c"];

function heatColor(losses: number, maxLosses: number): string {
  if (losses <= 0) {
    return HEAT_COLORS[0]!;
  }
  const index = Math.min(
    HEAT_COLORS.length - 1,
    Math.max(1, Math.ceil((losses / Math.max(1, maxLosses)) * (HEAT_COLORS.length - 1))),
  );
  return HEAT_COLORS[index]!;
}

export function renderBiomeHeatmap(container: HTMLElement, stats: BiomeStat[]): void {
  container.innerHTML = "";

  if (stats.length === 0) {
    container.innerHTML = `<p class="empty-hint">Play more runs to build a biome heatmap.</p>`;
    return;
  }

  const maxLosses = Math.max(...stats.map((s) => s.losses), 1);
  const width = 640;
  const rowHeight = 28;
  const labelWidth = 140;
  const barMaxWidth = width - labelWidth - 80;
  const height = stats.length * rowHeight + 16;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "biome-heatmap-svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", String(height));

  stats.forEach((stat, index) => {
    const y = 8 + index * rowHeight;
    const barWidth = Math.max(4, (stat.losses / maxLosses) * barMaxWidth);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", "0");
    label.setAttribute("y", String(y + 18));
    label.setAttribute("class", "heatmap-label");
    label.textContent = stat.biome.length > 16 ? `${stat.biome.slice(0, 15)}…` : stat.biome;
    svg.appendChild(label);

    const bar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bar.setAttribute("x", String(labelWidth));
    bar.setAttribute("y", String(y + 4));
    bar.setAttribute("width", String(barWidth));
    bar.setAttribute("height", "18");
    bar.setAttribute("rx", "4");
    bar.setAttribute("fill", heatColor(stat.losses, maxLosses));
    svg.appendChild(bar);

    const meta = document.createElementNS("http://www.w3.org/2000/svg", "text");
    meta.setAttribute("x", String(labelWidth + barMaxWidth + 8));
    meta.setAttribute("y", String(y + 18));
    meta.setAttribute("class", "heatmap-meta");
    meta.textContent = `${stat.losses}L · avg ${stat.avgWave.toFixed(0)}`;
    svg.appendChild(meta);

    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `${stat.biome}: ${stat.losses} losses across ${stat.encounters} runs, avg wave ${stat.avgWave.toFixed(1)}`;
    bar.appendChild(title);
  });

  container.appendChild(svg);
}
