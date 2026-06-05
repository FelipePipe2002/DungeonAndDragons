import type { Item } from "@/lib/informacion/items/store"

export interface ItemCardProps {
  item: Item
}

export function ItemCard({ item }: ItemCardProps) {
  const subtitle = [item.typeLabel, item.rarityLabel, item.attunement ? `Attunement ${item.attunement}` : ""].filter(Boolean).join(" · ")
  const statTags = [item.weightLabel, item.valueLabel].filter(Boolean)

  return (
    <article
      className="rounded-sm border bg-[linear-gradient(180deg,rgba(255,252,246,0.98),rgba(245,236,221,0.97))] p-6 shadow-[0_12px_26px_rgba(48,33,18,0.13)]"
      style={{ borderColor: "#d8c7ab", borderLeftWidth: 6, borderLeftColor: "#8a5a2b" }}
    >
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7b6249]">Item</p>
          <h2 className="text-3xl font-serif text-[#6f3116]">{item.name}</h2>
          {subtitle ? <p className="mt-1 text-sm text-[#6a5642]">{subtitle}</p> : null}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          {statTags.map((tag) => (
            <span
              key={`${item.name}-${tag}`}
              className="rounded-sm border bg-white/86 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ borderColor: "rgba(125, 62, 29, 0.18)", color: "#7d3e1d" }}
            >
              {tag}
            </span>
          ))}
        </div>
      </header>

      <div className="rounded-sm border p-4" style={{ borderColor: "#d7c5a8", backgroundColor: "rgba(255, 249, 238, 0.74)" }}>
        <div className="space-y-4">
          {item.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <span
                  key={`${item.name}-tag-${tag}`}
                  className="rounded-sm border px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-[#6a4b31]"
                  style={{ borderColor: "rgba(125, 62, 29, 0.16)", background: "rgba(255,255,255,0.76)" }}
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          {item.entries.length === 0 ? (
            <p className="text-sm text-[#6a5642]">Sin descripcion cargada.</p>
          ) : (
            item.entries.map((block, index) => {
              if (block.kind === "paragraph") {
                return (
                  <p key={`${item.name}-paragraph-${index}`} className="text-sm leading-7 text-[#3b2a1c]">
                    {block.name ? <strong>{block.name}: </strong> : null}
                    {block.text}
                  </p>
                )
              }

              if (block.kind === "list") {
                return (
                  <div key={`${item.name}-list-${index}`} className="space-y-2">
                    {block.name ? <p className="text-sm font-semibold text-[#6f3116]">{block.name}</p> : null}
                    <ul className="list-disc space-y-2 pl-5">
                      {block.items.map((entry, entryIndex) => (
                        <li key={`${item.name}-list-item-${index}-${entryIndex}`} className="text-sm leading-7 text-[#3b2a1c]">
                          {entry}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              }

              return (
                <div key={`${item.name}-table-${index}`} className="space-y-2">
                  {block.name ? <p className="text-sm font-semibold text-[#6f3116]">{block.name}</p> : null}
                  {block.caption ? <p className="text-xs uppercase tracking-[0.1em] text-[#7b6249]">{block.caption}</p> : null}
                  <div
                    className="overflow-x-auto rounded-sm border"
                    style={{ borderColor: "rgba(125, 62, 29, 0.18)", background: "rgba(255, 255, 255, 0.72)" }}
                  >
                    <table className="min-w-full text-left text-sm">
                      {block.headers.length > 0 ? (
                        <thead
                          className="border-b"
                          style={{ borderColor: "rgba(125, 62, 29, 0.18)", background: "rgba(125, 62, 29, 0.08)" }}
                        >
                          <tr>
                            {block.headers.map((header, headerIndex) => (
                              <th key={`${item.name}-table-header-${index}-${headerIndex}`} className="px-3 py-2 font-semibold text-[#352417]">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                      ) : null}
                      <tbody>
                        {block.rows.map((row, rowIndex) => (
                          <tr
                            key={`${item.name}-table-row-${index}-${rowIndex}`}
                            className="border-b last:border-b-0"
                            style={{ borderColor: "rgba(125, 62, 29, 0.16)" }}
                          >
                            {row.map((cell, cellIndex) => (
                              <td key={`${item.name}-table-cell-${index}-${rowIndex}-${cellIndex}`} className="px-3 py-2 text-[#3b2a1c]">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </article>
  )
}
