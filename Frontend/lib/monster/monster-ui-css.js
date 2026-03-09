export const MONSTER_UI_CSS = String.raw`
.monster-ui-theme {
  --page-bg: #ece2cf;
  --panel-bg: rgba(251, 246, 236, 0.97);
  --panel-border: #b99e73;
  --panel-border-soft: rgba(114, 84, 47, 0.18);
  --ink-strong: #21160f;
  --ink-soft: #5d4936;
  --accent: #7d3e1d;
  --accent-soft: rgba(125, 62, 29, 0.08);
  --accent-line: rgba(125, 62, 29, 0.24);
  --shadow: 0 18px 38px rgba(31, 20, 12, 0.12);
  --danger: #9d2d21;
  --danger-soft: rgba(157, 45, 33, 0.12);
  --font-body: Convergence, Arial, sans-serif;
  --font-display: Convergence, Arial, sans-serif;
  font-family: var(--font-body);
  color: var(--ink-strong);
  font-size: 15px;
}

.monster-ui-theme,
.monster-ui-theme * {
  box-sizing: border-box;
}

.monster-ui-theme pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: "Courier New", monospace;
  font-size: 0.8rem;
  line-height: 1.35;
}

.filters-panel {
  margin-bottom: 10px;
}

.filters-form {
  display: grid;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--panel-border-soft);
  border-radius: 12px;
  background: rgba(255, 248, 236, 0.82);
}

.filters-grid-text {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 6px;
}

.filters-grid-numeric {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 6px;
}

.filter-field {
  display: grid;
  gap: 3px;
}

.filter-field span {
  color: var(--ink-soft);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.filter-field input,
.filter-field select {
  border: 1px solid rgba(114, 84, 47, 0.2);
  border-radius: 8px;
  background: rgba(255, 252, 246, 0.95);
  color: var(--ink-strong);
  font: inherit;
  font-size: 0.78rem;
  min-height: 30px;
  padding: 4px 8px;
}

.filter-numeric {
  display: grid;
  gap: 4px;
  grid-template-columns: 58px 1fr;
}

.filter-numeric-wide {
  grid-template-columns: minmax(82px, 120px) 58px 1fr;
}

.filters-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.filter-button {
  border: 1px solid rgba(114, 84, 47, 0.22);
  border-radius: 999px;
  background: rgba(255, 250, 241, 0.94);
  color: var(--accent);
  cursor: pointer;
  font: inherit;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 5px 10px;
  text-transform: uppercase;
}

.filter-button:disabled {
  cursor: wait;
  opacity: 0.7;
}

.filter-button-secondary {
  background: rgba(32, 22, 13, 0.04);
}

.cards-stack {
  display: grid;
  gap: 10px;
  justify-items: start;
}

.feed-status {
  display: grid;
  gap: 10px;
  justify-items: center;
  margin-top: 22px;
}

.feed-status p {
  margin: 0;
  color: var(--ink-soft);
}

.sentinel-wrap {
  display: grid;
  gap: 1px;
  justify-items: center;
  width: 100%;
}

.load-more-button {
  border: 1px solid rgba(143, 59, 34, 0.2);
  border-radius: 999px;
  background: var(--accent);
  color: #fff7f1;
  padding: 12px 18px;
  font: inherit;
  cursor: pointer;
  transition:
    transform 120ms ease,
    opacity 120ms ease;
}

.load-more-button:hover {
  transform: translateY(-1px);
}

.load-more-button:disabled {
  cursor: wait;
  opacity: 0.7;
}

.scroll-sentinel {
  width: 100%;
  height: 1px;
}

.status-error {
  color: #9d1c1c;
}

.status-done {
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 0.8rem;
}

.monster-card {
  display: grid;
  gap: 6px;
  width: 100%;
  max-width: 100%;
  margin: 0;
  justify-self: start;
  padding: 10px;
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  background: var(--panel-bg);
  box-shadow: var(--shadow);
  position: relative;
  overflow: hidden;
}

.monster-card::before {
  content: "";
  position: absolute;
  inset: 6px;
  border: 1px solid rgba(114, 84, 47, 0.08);
  border-radius: 10px;
  pointer-events: none;
}

.monster-card-error {
  border-color: var(--danger);
  background: linear-gradient(180deg, rgba(157, 45, 33, 0.16), rgba(251, 246, 236, 0.98));
  box-shadow: 0 18px 40px rgba(157, 45, 33, 0.16);
}

.monster-card-error .card-header {
  border-bottom-color: rgba(157, 45, 33, 0.28);
}

.card-header {
  display: grid;
  gap: 4px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--accent-line);
}

.card-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.card-header-tools {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;
}

.card-index {
  margin: 0;
  color: var(--ink-soft);
  font-size: 0.7rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
}

.card-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.18rem, 1.45vw, 1.55rem);
  line-height: 0.95;
  letter-spacing: 0.02em;
}

.card-title-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
  align-items: start;
}

.monster-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.summary-chip {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: 2px 8px;
  border: 1px solid var(--panel-border-soft);
  border-radius: 999px;
  background: rgba(255, 251, 243, 0.88);
  color: var(--ink-soft);
  font-size: 0.72rem;
  line-height: 1.1;
}

.summary-chip-alert {
  border-color: rgba(157, 45, 33, 0.22);
  background: var(--danger-soft);
  color: var(--danger);
}

.combat-summary-grid {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(48px, 56px);
  gap: 3px;
  align-content: start;
}

.summary-stat {
  display: grid;
  gap: 1px;
  min-height: 42px;
  padding: 4px 3px;
  text-align: center;
  justify-items: center;
  align-content: start;
  border: 1px solid var(--panel-border-soft);
  border-radius: 7px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.58), rgba(125, 62, 29, 0.03)),
    rgba(255, 248, 236, 0.92);
}

.summary-stat span {
  color: var(--ink-soft);
  font-size: 0.52rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.summary-stat strong {
  color: var(--ink-strong);
  font-family: var(--font-display);
  font-size: 0.9rem;
  line-height: 1.02;
  font-weight: 700;
}

.combat-facts {
  margin-top: 2px;
}

.combat-facts-lines {
  display: grid;
  gap: 2px;
}

.combat-fact-text {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.2;
  color: var(--ink-strong);
}

.combat-fact-text strong {
  color: var(--ink-soft);
  font-size: 0.66rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.combat-bands {
  display: grid;
  gap: 4px;
}

.summary-band {
  display: grid;
  grid-template-columns: minmax(64px, 82px) 1fr;
  gap: 6px;
  align-items: start;
  padding: 4px 8px;
  border-radius: 8px;
  border: 1px solid var(--panel-border-soft);
  background: rgba(255, 249, 239, 0.8);
}

.summary-band span {
  color: var(--ink-soft);
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.summary-band strong {
  color: var(--ink-strong);
  font-size: 0.78rem;
  line-height: 1.2;
}

.summary-band-danger {
  background: rgba(157, 45, 33, 0.08);
  border-color: rgba(157, 45, 33, 0.16);
}

.summary-band-warn {
  background: rgba(125, 62, 29, 0.08);
}

.summary-band-neutral {
  background: rgba(88, 56, 24, 0.05);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  justify-content: stretch;
  gap: 5px;
}

.stats-column {
  display: grid;
  width: 100%;
  min-width: 0;
  gap: 2px;
  padding: 5px 6px;
  border-radius: 8px;
  border: 1px solid var(--panel-border-soft);
  background: rgba(32, 22, 13, 0.04);
}

.stat-head,
.stat-row {
  display: grid;
  grid-template-columns: minmax(max-content, 1fr) repeat(3, minmax(max-content, 1fr));
  gap: 8px;
  align-items: center;
}

.stat-head {
  padding-bottom: 2px;
  border-bottom: 1px solid rgba(114, 84, 47, 0.14);
}

.stat-head span {
  color: var(--ink-soft);
  font-size: 0.5rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-align: center;
  text-transform: uppercase;
}

.stat-head-spacer {
  visibility: hidden;
}

.stat-label {
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--ink-soft);
  font-weight: 700;
  white-space: nowrap;
}

.stat-value,
.stat-mod,
.stat-save {
  color: var(--ink-strong);
  font-family: var(--font-display);
  font-size: 0.84rem;
  font-weight: 700;
  line-height: 1.1;
  text-align: center;
  white-space: nowrap;
}

.extras-list {
  display: grid;
  gap: 6px;
}

.traits-block,
.actions-block,
.spellcasting-block {
  display: grid;
  gap: 4px;
}

.traits-block h2,
.actions-block h2,
.spellcasting-block h2 {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--accent);
  font-family: var(--font-display);
  font-size: 0.9rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.traits-block h2::after,
.actions-block h2::after,
.spellcasting-block h2::after {
  content: "";
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, var(--accent-line), transparent);
}

.trait-card {
  display: grid;
  gap: 3px;
  padding: 4px 0 0;
  border-top: 1px solid rgba(114, 84, 47, 0.14);
}

.action-card {
  display: grid;
  gap: 3px;
  padding: 4px 0 0;
  border-top: 1px solid rgba(114, 84, 47, 0.14);
}

.trait-card strong {
  color: var(--ink-strong);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.action-card strong {
  color: var(--ink-strong);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.entry-list {
  margin: 0;
  padding-left: 14px;
  display: grid;
  gap: 1px;
  font-size: 0.82rem;
  color: var(--ink-soft);
}

.entry-line {
  line-height: 1.24;
}

.action-lines {
  display: grid;
  gap: 2px;
  font-size: 0.82rem;
  color: var(--ink-soft);
}

.action-lines p {
  margin: 0;
  line-height: 1.24;
}

.fallback-pill {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 6px;
  background: rgba(157, 45, 33, 0.9);
  color: #fff8ee;
  font-size: 0.72rem;
}

.fallback-block {
  background: rgba(157, 45, 33, 0.9);
  color: #fff8ee;
  padding: 6px;
  border-radius: 6px;
}

.text-alert {
  color: var(--danger);
  font-weight: 600;
}

.error-pill {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(157, 45, 33, 0.24);
  background: rgba(157, 45, 33, 0.92);
  color: #fff8ee;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.extra-row {
  display: grid;
  grid-template-columns: minmax(95px, 125px) 1fr;
  gap: 8px;
  align-items: start;
  padding-top: 6px;
  border-top: 1px dashed rgba(114, 84, 47, 0.22);
}

.extra-row strong {
  font-size: 0.74rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.extra-row > div {
  color: var(--ink-soft);
  line-height: 1.35;
}

.monster-lines {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
}

.monster-line {
  display: grid;
  grid-template-columns: minmax(92px, 120px) 1fr;
  gap: 8px;
  align-items: start;
  padding: 0;
}

.monster-line dt,
.monster-line dd {
  margin: 0;
}

.monster-line dt {
  color: var(--ink-soft);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.monster-line dd {
  color: var(--ink-strong);
  line-height: 1.28;
}

.details-toggle {
  border: 1px solid rgba(114, 84, 47, 0.22);
  border-radius: 999px;
  background: rgba(255, 250, 241, 0.94);
  color: var(--accent);
  cursor: pointer;
  font: inherit;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 4px 8px;
  text-transform: uppercase;
  transition:
    background 120ms ease,
    transform 120ms ease;
}

.details-toggle:hover {
  background: rgba(125, 62, 29, 0.08);
  transform: translateY(-1px);
}

.details-panel {
  display: grid;
  gap: 6px;
  padding-top: 2px;
}

.details-lines {
  display: grid;
  gap: 6px 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 8px 0 1px;
  border-top: 1px dashed rgba(114, 84, 47, 0.22);
}

.detail-line {
  padding: 0;
}

@media (max-width: 640px) {
  .monster-card {
    width: 100%;
    max-width: 100%;
    padding: 10px;
    border-radius: 12px;
  }

  .summary-band {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .monster-line,
  .extra-row,
  .detail-line {
    grid-template-columns: 1fr;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .stats-column {
    width: 100%;
  }

  .stat-head,
  .stat-row {
    grid-template-columns: minmax(24px, 1fr) repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .details-lines {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .card-title-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .combat-summary-grid {
    grid-auto-flow: row;
    grid-auto-columns: auto;
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}
`;
