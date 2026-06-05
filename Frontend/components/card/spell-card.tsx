import type { Spell } from "@/lib/informacion/spells/store"

export interface SpellCardProps {
  spell: Spell
}

type SpellTone = {
  accent: string
  soft: string
}

const SCHOOL_TONES: Record<string, SpellTone> = {
  A: { accent: "#355d8d", soft: "rgba(53, 93, 141, 0.14)" },
  C: { accent: "#417a66", soft: "rgba(65, 122, 102, 0.14)" },
  D: { accent: "#5d5f8c", soft: "rgba(93, 95, 140, 0.14)" },
  E: { accent: "#8a4f7a", soft: "rgba(138, 79, 122, 0.14)" },
  I: { accent: "#6b5a9d", soft: "rgba(107, 90, 157, 0.14)" },
  N: { accent: "#7a4456", soft: "rgba(122, 68, 86, 0.14)" },
  T: { accent: "#7f6a39", soft: "rgba(127, 106, 57, 0.14)" },
  V: { accent: "#8c4f2a", soft: "rgba(140, 79, 42, 0.14)" },
}

function renderList(values: string[]): string {
  return values.join(", ")
}

function hasValue(value: string): boolean {
  const trimmed = value.trim()
  return !!trimmed && trimmed !== "-"
}

export function SpellCard({ spell }: SpellCardProps) {
  const tone = SCHOOL_TONES[spell.schoolCode] ?? { accent: "#7d3e1d", soft: "rgba(125, 62, 29, 0.14)" }
  const metaRows = [
    { label: "Casting Time", value: spell.castingTimeLabel },
    { label: "Range", value: spell.range },
    { label: "Components", value: spell.components },
    { label: "Duration", value: spell.duration },
    { label: "Damage", value: renderList(spell.damageTypes) },
    { label: "Saving Throw", value: renderList(spell.savingThrows) },
  ].filter((row) => hasValue(row.value))

  return (
    <article
      className="rounded-sm border bg-[linear-gradient(180deg,rgba(255,252,246,0.98),rgba(245,236,221,0.97))] p-6 shadow-[0_12px_26px_rgba(48,33,18,0.13)]"
      style={{ borderColor: "#d8c7ab", borderLeftWidth: 6, borderLeftColor: tone.accent }}
    >
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7b6249]">Spell</p>
          <h2 className="text-3xl font-serif text-[#6f3116]">{spell.name}</h2>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.13em]" style={{ color: tone.accent }}>
            {spell.schoolLabel}
          </p>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
          <span
            className="rounded-sm border bg-white/86 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ borderColor: tone.soft, color: tone.accent }}
          >
            {spell.levelLabel}
          </span>
          {spell.isRitual ? (
            <span
              className="rounded-sm border bg-white/86 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ borderColor: tone.soft, color: tone.accent }}
            >
              Ritual
            </span>
          ) : null}
        </div>
      </header>

      <div className="rounded-sm border p-4" style={{ borderColor: "#d7c5a8", backgroundColor: "rgba(255, 249, 238, 0.74)" }}>
        <div className="space-y-4">
          {metaRows.length > 0 ? (
            <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {metaRows.map((row) => (
                <div
                  key={`${spell.name}-${row.label}`}
                  className="rounded-sm border p-3"
                  style={{ borderColor: "rgba(125, 62, 29, 0.18)", background: "rgba(255, 255, 255, 0.72)" }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7b6249]">{row.label}</p>
                  <p className="mt-1 text-sm text-[#352417]">{row.value}</p>
                </div>
              ))}
            </section>
          ) : null}

          {spell.description.length > 0 ? (
            <section className="space-y-2">
              {spell.description.map((line, idx) => (
                <p key={`${spell.name}-desc-${idx}`} className="text-sm leading-7 text-[#3b2a1c]">
                  {line.name ? <strong>{line.name}: </strong> : null}
                  {line.text}
                </p>
              ))}
            </section>
          ) : null}

          {spell.higherLevel.length > 0 ? (
            <section className="space-y-2 border-t border-dashed border-[#cdb89a] pt-2">
              {spell.higherLevel.map((line, idx) => (
                <p key={`${spell.name}-high-${idx}`} className="text-sm leading-7 text-[#3b2a1c]">
                  {line.name ? <strong>{line.name}: </strong> : null}
                  {line.text}
                </p>
              ))}
            </section>
          ) : null}
        </div>
      </div>
    </article>
  )
}
