import type { ChartPoint, RunRecap, TimelineNode } from "../analytics/run-recap";
import { renderPartyMemberDetailHtml } from "../shared/party-detail";
import { renderPartyIconsHtml, renderPokemonIconHtml } from "../shared/pokemon-sprites";

export type TimelineFilter =
  | "all"
  | "wave"
  | "trainer"
  | "party"
  | "money"
  | "biome"
  | "enemy"
  | "modifier"
  | "voucher"
  | "evolution";

export interface TimelineSelection {
  wave: number | null;
  nodeId: number | string | null;
}

const NODE_COLORS: Record<string, string> = {
  run_start: "#60a5fa",
  run_end: "#f87171",
  wave_change: "#38bdf8",
  trainer_battle: "#fbbf24",
  party_change: "#4ade80",
  biome_change: "#c084fc",
  money_change: "#fcd34d",
  enemy_change: "#fb923c",
  modifier_change: "#a78bfa",
  voucher_change: "#f472b6",
  snapshot: "#9ca3af",
};

function nodeColor(eventType: string): string {
  return NODE_COLORS[eventType] ?? "#9ca3af";
}

function filterNodes(nodes: TimelineNode[], filter: TimelineFilter): TimelineNode[] {
  if (filter === "all") {
    return nodes;
  }
  if (filter === "wave") {
    return nodes.filter((n) => n.eventType === "wave_change" || n.eventType === "run_start" || n.eventType === "run_end");
  }
  if (filter === "trainer") {
    return nodes.filter((n) => n.eventType === "trainer_battle" || Boolean(n.trainerName));
  }
  if (filter === "party") {
    return nodes.filter((n) => n.eventType === "party_change");
  }
  if (filter === "money") {
    return nodes.filter((n) => n.eventType === "money_change");
  }
  if (filter === "biome") {
    return nodes.filter((n) => n.eventType === "biome_change" || Boolean(n.biome));
  }
  if (filter === "enemy") {
    return nodes.filter((n) => n.eventType === "enemy_change" || n.enemy.length > 0);
  }
  if (filter === "modifier") {
    return nodes.filter((n) => n.eventType === "modifier_change");
  }
  if (filter === "voucher") {
    return nodes.filter((n) => n.eventType === "voucher_change");
  }
  if (filter === "evolution") {
    return nodes.filter((n) => n.isEvolution === true);
  }
  return nodes;
}

function waveRange(nodes: TimelineNode[]): { min: number; max: number } {
  const waves = nodes.map((n) => n.wave).filter((w): w is number => typeof w === "number");
  if (waves.length === 0) {
    return { min: 1, max: 1 };
  }
  return { min: Math.min(...waves), max: Math.max(...waves) };
}

export function renderTimeline(
  container: HTMLElement,
  recap: RunRecap,
  filter: TimelineFilter,
  selection: TimelineSelection,
  onSelect: (selection: TimelineSelection, node: TimelineNode | null) => void,
): void {
  container.innerHTML = "";
  const nodes = filterNodes(recap.timelineNodes, filter);
  if (nodes.length === 0) {
    container.innerHTML = `<p class="empty-hint">No events for this filter.</p>`;
    return;
  }

  const { min, max } = waveRange(nodes);
  const span = Math.max(1, max - min);
  const width = Math.max(640, nodes.length * 48);
  const height = 120;
  const padX = 40;
  const trackY = 60;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "timeline-svg");
  svg.setAttribute("viewBox", `0 0 ${width + padX * 2} ${height}`);
  svg.setAttribute("width", String(width + padX * 2));
  svg.setAttribute("height", String(height));

  const track = document.createElementNS("http://www.w3.org/2000/svg", "line");
  track.setAttribute("x1", String(padX));
  track.setAttribute("y1", String(trackY));
  track.setAttribute("x2", String(width + padX));
  track.setAttribute("y2", String(trackY));
  track.setAttribute("class", "timeline-track");
  svg.appendChild(track);

  for (let wave = min; wave <= max; wave++) {
    const x = padX + ((wave - min) / span) * width;
    const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
    tick.setAttribute("x1", String(x));
    tick.setAttribute("y1", String(trackY - 6));
    tick.setAttribute("x2", String(x));
    tick.setAttribute("y2", String(trackY + 6));
    tick.setAttribute("class", "timeline-tick");
    svg.appendChild(tick);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", String(x));
    label.setAttribute("y", String(trackY + 22));
    label.setAttribute("class", "timeline-wave-label");
    label.textContent = String(wave);
    svg.appendChild(label);
  }

  nodes.forEach((node, index) => {
    const wave = node.wave ?? min;
    const x = padX + ((wave - min) / span) * width + (index % 3) * 4 - 4;
    const y = trackY - (index % 2 === 0 ? 28 : 28);
    const isSelected = selection.nodeId === node.id || (selection.wave === node.wave && !selection.nodeId);

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", String(x));
    circle.setAttribute("cy", String(y));
    circle.setAttribute("r", isSelected ? "9" : "7");
    circle.setAttribute("fill", nodeColor(node.eventType));
    circle.setAttribute("class", `timeline-node${isSelected ? " selected" : ""}`);
    circle.setAttribute("data-node-id", String(node.id));

    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `W${node.wave ?? "?"} — ${node.label}`;
    circle.appendChild(title);

    circle.addEventListener("click", () => {
      onSelect({ wave: node.wave, nodeId: node.id }, node);
    });

    circle.addEventListener("mouseenter", () => {
      onSelect({ wave: node.wave, nodeId: node.id }, node);
    });

    svg.appendChild(circle);
  });

  container.appendChild(svg);
}

export function renderSparkline(
  container: HTMLElement,
  label: string,
  series: ChartPoint[],
  valueKey: "money" | "score",
  selection: TimelineSelection,
  onSelect: (wave: number) => void,
): void {
  container.innerHTML = "";

  if (series.length === 0) {
    container.innerHTML = `<p class="empty-hint">No ${label} data yet.</p>`;
    return;
  }

  const width = 320;
  const height = 80;
  const pad = 16;
  const values = series.map((p) => p[valueKey]);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const valSpan = Math.max(1, maxVal - minVal);
  const minWave = series[0]!.wave;
  const maxWave = series[series.length - 1]!.wave;
  const waveSpan = Math.max(1, maxWave - minWave);

  const heading = document.createElement("div");
  heading.className = "sparkline-label";
  heading.textContent = label;
  container.appendChild(heading);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("class", "sparkline-svg");

  const points = series
    .map((point) => {
      const x = pad + ((point.wave - minWave) / waveSpan) * (width - pad * 2);
      const y = height - pad - ((point[valueKey] - minVal) / valSpan) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyline.setAttribute("points", points);
  polyline.setAttribute("class", "sparkline-line");
  svg.appendChild(polyline);

  for (const point of series) {
    const x = pad + ((point.wave - minWave) / waveSpan) * (width - pad * 2);
    const y = height - pad - ((point[valueKey] - minVal) / valSpan) * (height - pad * 2);
    const isSelected = selection.wave === point.wave;

    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", String(x));
    dot.setAttribute("cy", String(y));
    dot.setAttribute("r", isSelected ? "6" : "4");
    dot.setAttribute("class", `sparkline-dot${isSelected ? " selected" : ""}`);
    dot.addEventListener("click", () => onSelect(point.wave));
    svg.appendChild(dot);
  }

  container.appendChild(svg);
}

export function renderDetailPanel(container: HTMLElement, node: TimelineNode | null): void {
  container.innerHTML = "";

  if (!node) {
    container.innerHTML = `<p class="empty-hint">Hover or click a timeline node for details.</p>`;
    return;
  }

  const partyIcons = node.party
    .map((member, idx) => `<span class="party-icon-wrapper" data-index="${idx}">${renderPokemonIconHtml(member, { size: 32, showLevel: true })}</span>`)
    .join("");
  const enemyIcons = renderPartyIconsHtml(node.enemy, { size: 32, showLevel: true });
  const partyDetails = node.party
    .map((member, idx) => `<div class="party-detail-item" data-index="${idx}" style="display:${idx===0?"block":"none"}">${renderPartyMemberDetailHtml(member)}</div>`)
    .join("");
  const enemyDetails = node.enemy.map((member) => renderPartyMemberDetailHtml(member)).join("");

  container.innerHTML = `
    <div class="detail-header">
      <span class="detail-type">${node.eventType.replace(/_/g, " ")}</span>
      <span class="detail-wave">Wave ${node.wave ?? "?"}</span>
    </div>
    <p class="detail-label">${escapeHtml(node.label)}</p>
    <div class="detail-grid">
      <div><span>Money</span><strong>${node.money ?? "—"}</strong></div>
      <div><span>Score</span><strong>${node.score ?? "—"}</strong></div>
      <div><span>Biome</span><strong>${escapeHtml(node.biome ?? "—")}</strong></div>
      <div><span>Time</span><strong>${new Date(node.timestamp).toLocaleTimeString()}</strong></div>
    </div>
    ${partyIcons ? `<div class="detail-party-row"><span>Party</span><div class="party-icons">${partyIcons}</div></div>${partyDetails}` : ""}
    ${enemyIcons ? `<div class="detail-party-row"><span>Enemy</span><div class="party-icons">${enemyIcons}</div></div>${enemyDetails}` : ""}
  `;

  // wire up icon clicks to show the respective member detail
  if (partyIcons && node.party.length > 0) {
    const iconWrap = container.querySelector('.party-icons');
    if (iconWrap) {
      iconWrap.querySelectorAll('.party-icon-wrapper').forEach((el) => {
        el.addEventListener('click', () => {
          const idx = Number((el as HTMLElement).getAttribute('data-index')) || 0;
          const detailItems = container.querySelectorAll('.party-detail-item');
          detailItems.forEach((d) => {
            const di = Number((d as HTMLElement).getAttribute('data-index')) || 0;
            (d as HTMLElement).style.display = di === idx ? 'block' : 'none';
          });
        });
      });
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderPartyCompare(
  container: HTMLElement,
  startLabel: string,
  startParty: RunRecap["startParty"],
  endLabel: string,
  endParty: RunRecap["currentParty"],
): void {
  container.innerHTML = `
    <div class="party-compare">
      <div class="party-col">
        <h3>${escapeHtml(startLabel)}</h3>
        <div class="party-pills">${renderPartyPills(startParty)}</div>
      </div>
      <div class="party-col">
        <h3>${escapeHtml(endLabel)}</h3>
        <div class="party-pills">${renderPartyPills(endParty)}</div>
      </div>
    </div>
  `;
}

function renderPartyPills(party: RunRecap["startParty"]): string {
  if (party.length === 0) {
    return `<span class="empty-hint">—</span>`;
  }

  return party
    .map((member) => {
      const icon = renderPartyIconsHtml([member], { size: 40, showLevel: true });
      const detail = renderPartyMemberDetailHtml(member);
      return `<div class="party-member-card">${icon}${detail}</div>`;
    })
    .join("");
}
