import type { Rule } from "@/lib/informacion/rules/store"

export interface RuleCardProps {
  rule: Rule
}

export function RuleCard({ rule }: RuleCardProps) {
  return (
    <article
      className="rounded-sm border bg-[linear-gradient(180deg,rgba(255,252,246,0.98),rgba(245,236,221,0.97))] p-6 shadow-[0_12px_26px_rgba(48,33,18,0.13)]"
      style={{ borderColor: "#d8c7ab", borderLeftWidth: 6, borderLeftColor: "#6d533b" }}
    >
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7b6249]">Regla</p>
          <h2 className="text-3xl font-serif text-[#6f3116]">{rule.name}</h2>
        </div>
      </header>

      <div className="rounded-sm border p-4" style={{ borderColor: "#d7c5a8", backgroundColor: "rgba(255, 249, 238, 0.74)" }}>
        <div className="space-y-4">
          {rule.entries.length === 0 ? (
            <p className="text-sm text-[#6a5642]">Sin descripcion cargada.</p>
          ) : (
            rule.entries.map((block, index) => {
              if (block.kind === "paragraph") {
                return (
                  <p key={`${rule.name}-paragraph-${index}`} className="text-sm leading-7 text-[#3b2a1c]">
                    {block.name ? <strong>{block.name}: </strong> : null}
                    {block.text}
                  </p>
                )
              }

              if (block.kind === "list") {
                return (
                  <div key={`${rule.name}-list-${index}`} className="space-y-2">
                    {block.name ? <p className="text-sm font-semibold text-[#6f3116]">{block.name}</p> : null}
                    <ul className="list-disc space-y-2 pl-5">
                      {block.items.map((item, itemIndex) => (
                        <li key={`${rule.name}-list-item-${index}-${itemIndex}`} className="text-sm leading-7 text-[#3b2a1c]">
                          {item.name ? <strong>{item.name}. </strong> : null}
                          {item.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              }

              return (
                <div key={`${rule.name}-table-${index}`} className="space-y-2">
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
                              <th key={`${rule.name}-table-header-${index}-${headerIndex}`} className="px-3 py-2 font-semibold text-[#352417]">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                      ) : null}
                      <tbody>
                        {block.rows.map((row, rowIndex) => (
                          <tr
                            key={`${rule.name}-table-row-${index}-${rowIndex}`}
                            className="border-b last:border-b-0"
                            style={{ borderColor: "rgba(125, 62, 29, 0.16)" }}
                          >
                            {row.map((cell, cellIndex) => (
                              <td key={`${rule.name}-table-cell-${index}-${rowIndex}-${cellIndex}`} className="px-3 py-2 text-[#3b2a1c]">
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
