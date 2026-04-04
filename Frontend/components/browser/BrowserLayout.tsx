import type { CSSProperties, ReactNode } from "react"

type BrowserLayoutProps = {
  header?: ReactNode
  sidebar: ReactNode
  detail: ReactNode
}

export function BrowserLayout({ header, sidebar, detail }: BrowserLayoutProps) {
  const contentOffset = header ? "16rem" : "11.25rem"

  return (
    <div
      className="relative mx-auto flex w-full max-w-[1700px] flex-col gap-4 px-4 py-4 md:px-6 md:py-5"
      style={{ "--browser-content-offset": contentOffset } as CSSProperties}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56 bg-[radial-gradient(circle_at_top,rgba(205,171,127,0.22),rgba(255,255,255,0))]"
      />
      {header ? header : null}
      <section className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
        {sidebar}
        {detail}
      </section>
    </div>
  )
}
