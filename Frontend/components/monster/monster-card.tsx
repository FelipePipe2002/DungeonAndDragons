// @ts-nocheck
"use client"

import { useState } from "react"
import type { MonsterRecord } from "@/lib/monster/types"

import { MONSTER_UI_CSS } from "@/lib/monster/monster-ui-css"
import { buildMonsterPanelModel, cleanInlineText, containsAlertMarker } from "@/lib/monster/monster-panel-service"
import { resolveMonsterImage } from "@/lib/monster/utils"

function renderInlineText(text, key) {
  const raw = text;
  const cleaned = cleanInlineText(text);
  if (!cleaned) {
    return "";
  }

  if (containsAlertMarker(raw)) {
    return (
      <span key={key} className="text-alert">
        {cleaned}
      </span>
    );
  }

  return cleaned;
}

function renderEntryNode(node, key) {
  if (!node) {
    return null;
  }

  if (node.kind === "text") {
    return (
      <li key={key} className="entry-line">
        {renderInlineText(node.text, key)}
      </li>
    );
  }

  if (node.kind === "list") {
    return (
      <li key={key} className="entry-line">
        <ul className="entry-list">
          {node.items.map((item, index) => renderEntryNode(item, `${key}-item-${index}`))}
        </ul>
      </li>
    );
  }

  if (node.kind === "itemSub") {
    return (
      <li key={key} className="entry-line">
        {node.name && <strong>{renderInlineText(node.name, `${key}-name`)}</strong>}
        {(node.inlineText || "").length > 0 && node.name ? " " : ""}
        {node.inlineText && renderInlineText(node.inlineText, `${key}-inline`)}
        {node.entryItems.length > 0 && (
          <ul className="entry-list">
            {node.entryItems.map((item, index) => renderEntryNode(item, `${key}-entry-${index}`))}
          </ul>
        )}
        {node.items.length > 0 && (
          <ul className="entry-list">
            {node.items.map((item, index) => renderEntryNode(item, `${key}-item-${index}`))}
          </ul>
        )}
      </li>
    );
  }

  if (node.kind === "item") {
    return (
      <li key={key} className="entry-line">
        {node.name && <strong>{renderInlineText(node.name, `${key}-name`)}</strong>}
        {node.items.length > 0 && (
          <ul className="entry-list">
            {node.items.map((item, index) => renderEntryNode(item, `${key}-item-${index}`))}
          </ul>
        )}
      </li>
    );
  }

  if (node.kind === "fallback") {
    return (
      <li key={key} className="entry-line">
        <span className="fallback-pill">{node.text}</span>
      </li>
    );
  }

  return null;
}

function renderCardLine(line, key) {
  if (!line) {
    return null;
  }

  if (line.kind === "fallback") {
    return (
      <p key={key}>
        <span className="fallback-pill">{line.text}</span>
      </p>
    );
  }

  if (line.kind === "labeled") {
    return (
      <p key={key}>
        {line.label}: {renderInlineText(line.text, `${key}-text`)}
      </p>
    );
  }

  if (line.kind === "inlineTitleText") {
    return (
      <p key={key}>
        {line.title && <strong>{renderInlineText(`${line.title}${line.suffix || ""}`, `${key}-title`)}</strong>}
        {line.title && line.text ? " " : ""}
        {line.text && renderInlineText(line.text, `${key}-text`)}
      </p>
    );
  }

  return <p key={key}>{renderInlineText(line.text, `${key}-text`)}</p>;
}

function DataLine({ label, value, className = "monster-line" }) {
  if (!value) {
    return null;
  }

  return (
    <div className={className}>
      <dt>{label}</dt>
      <dd>{renderInlineText(value, `data-line-${label}`)}</dd>
    </div>
  );
}

function CombatFactsBlock({ rows }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return (
    <section className="combat-facts">
      <div className="combat-facts-lines">
        {rows.map((row) => (
          <p key={row.label} className="combat-fact-text">
            <strong>{row.label}</strong> : {renderInlineText(row.value, `combat-fact-${row.label}`)}
          </p>
        ))}
      </div>
    </section>
  );
}

function SummaryBand({ label, value, tone = "default" }) {
  if (!value) {
    return null;
  }

  return (
    <div className={`summary-band summary-band-${tone}`}>
      <span>{label}</span>
      <strong>{renderInlineText(value, `summary-band-${label}`)}</strong>
    </div>
  );
}

function SummaryChip({ chip }) {
  if (!chip?.text) {
    return null;
  }

  const className =
    chip.tone === "alert" ? "summary-chip summary-chip-alert" : "summary-chip";

  return <span className={className}>{renderInlineText(chip.text, `meta-chip-${chip.text}`)}</span>;
}

function StatsBlock({ columns }) {
  if (!Array.isArray(columns) || columns.length === 0) {
    return null;
  }

  return (
    <section className="stats-grid">
      {columns.map((column, columnIndex) => (
        <div className="stats-column" key={`stats-column-${columnIndex}`}>
          <div className="stat-head" aria-hidden="true">
            <span className="stat-head-spacer" />
            <span>Val</span>
            <span>Mod</span>
            <span>Save</span>
          </div>
          {column.map((stat) => (
            <div className="stat-row" key={stat.label}>
              <span className="stat-label">{stat.label}</span>
              <strong className="stat-value">{stat.value}</strong>
              <span className="stat-mod">{stat.mod}</span>
              <span className="stat-save">{stat.save}</span>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

function SectionCard({ card, cardClassName, sectionKey, cardIndex }) {
  if (!card) {
    return null;
  }

  if (card.kind === "lines") {
    return (
      <div className={cardClassName} key={`${sectionKey}-card-${cardIndex}`}>
        {card.title && <strong>{renderInlineText(card.title, `${sectionKey}-card-${cardIndex}-title`)}</strong>}
        {card.lines.length > 0 && (
          <div className="action-lines">
            {card.lines.map((line, lineIndex) =>
              renderCardLine(line, `${sectionKey}-card-${cardIndex}-line-${lineIndex}`)
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cardClassName} key={`${sectionKey}-card-${cardIndex}`}>
      {card.title && <strong>{renderInlineText(card.title, `${sectionKey}-card-${cardIndex}-title`)}</strong>}
      {card.entries.length > 0 && (
        <ul className="entry-list">
          {card.entries.map((entry, entryIndex) =>
            renderEntryNode(entry, `${sectionKey}-card-${cardIndex}-entry-${entryIndex}`)
          )}
        </ul>
      )}
    </div>
  );
}

function PanelSection({ section }) {
  if (!section?.cards?.length) {
    return null;
  }

  return (
    <section className={section.className}>
      <h2>{section.title}</h2>
      {section.cards.map((card, index) => (
        <SectionCard
          card={card}
          cardClassName={section.cardClassName}
          cardIndex={index}
          key={`${section.key}-${index}`}
          sectionKey={section.key}
        />
      ))}
    </section>
  );
}

function CopyErrorsBlock({ errors }) {
  if (!Array.isArray(errors) || errors.length === 0) {
    return null;
  }

  return (
    <section className="extras-list">
      {errors.map((error, index) => (
        <div className="extra-row" key={`copy-error-${index}`}>
          <strong className="text-alert">_copy</strong>
          <div className="text-alert">{renderInlineText(error, `copy-error-${index}`)}</div>
        </div>
      ))}
    </section>
  );
}

function ExtraFields({ extras }) {
  if (!Array.isArray(extras) || extras.length === 0) {
    return null;
  }

  return (
    <section className="extras-list">
      {extras.map((extra) => (
        <div className="extra-row" key={extra.key}>
          <strong className="text-alert">{extra.key}</strong>
          <div>
            {extra.kind === "block" ? (
              <pre className="fallback-block">{extra.text}</pre>
            ) : (
              <span>{renderInlineText(extra.text, `extra-${extra.key}`)}</span>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

function DetailsBlock({ details, isOpen }) {
  if (!details?.hasContent || !isOpen) {
    return null;
  }

  return (
    <section className="details-panel" id={details.id}>
      {details.rows.length > 0 && (
        <dl className="monster-lines details-lines">
          {details.rows.map((row) => (
            <DataLine
              key={row.label}
              className="monster-line detail-line"
              label={row.label}
              value={row.value}
            />
          ))}
        </dl>
      )}
      <PanelSection section={details.gearSection} />
      <CopyErrorsBlock errors={details.copyErrors} />
      <ExtraFields extras={details.extras} />
    </section>
  );
}

type MonsterCardProps = {
  monster: MonsterRecord
  index: number
  embedded?: boolean
}

export default function MonsterCard({ monster, index, embedded = false }: MonsterCardProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const panel = buildMonsterPanelModel(monster, index)
  const monsterImage = resolveMonsterImage(monster)
  const body = (
    <>
      <StatsBlock columns={panel.statsColumns} />
      <CombatFactsBlock rows={panel.combatRows} />

      {panel.bands.length > 0 && (
        <section className="combat-bands">
          {panel.bands.map((band) => (
            <SummaryBand key={band.label} label={band.label} tone={band.tone} value={band.value} />
          ))}
        </section>
      )}

      {panel.sections.map((section) => (
        <PanelSection key={section.key} section={section} />
      ))}

      <DetailsBlock details={panel.details} isOpen={isDetailsOpen} />
    </>
  )
  return (
    <article
      className={`monster-ui-theme monster-card${panel.hasError ? " monster-card-error" : ""}`}
    >
      {embedded ? <style data-monster-ui="true">{MONSTER_UI_CSS}</style> : null}
      <header className="card-header">
        <div className="card-header-top">
          <p className="card-index">{embedded ? "Monstruo" : panel.indexLabel}</p>
          <div className="card-header-tools">
            {panel.hasError && <span className="error-pill">{panel.errorLabel}</span>}
            {panel.hasDetailsContent && (
              <button
                aria-controls={panel.details.id}
                aria-expanded={isDetailsOpen}
                className="details-toggle"
                onClick={() => setIsDetailsOpen((current) => !current)}
                type="button"
              >
                {isDetailsOpen ? "Hide details" : "Show details"}
              </button>
            )}
          </div>
        </div>
        <div className="card-title-row">
          <div className="card-title-copy">
            <h1 className="card-title">{panel.title}</h1>
            {panel.metaChips.length > 0 && (
              <div className="monster-meta">
                {panel.metaChips.map((chip, index) => (
                  <SummaryChip chip={chip} key={`meta-chip-${index}`} />
                ))}
              </div>
            )}
          </div>
          {monsterImage && (
            <img
              alt={panel.title || monster.name || "Monster image"}
              className="monster-portrait-image"
              loading="lazy"
              src={monsterImage}
            />
          )}
        </div>
      </header>
      {embedded ? <div className="monster-inner-panel">{body}</div> : body}
    </article>
  );
}
