import type { ReactNode } from "react"

type BrowserSearchProps = {
  value: string
  onChange: (value: string) => void
  placeholder: string
  controls?: ReactNode
}

export function BrowserSearch({ value, onChange, placeholder, controls }: BrowserSearchProps) {
  return (
    <div className="mb-4 space-y-3">
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-sm border border-[#c9b393] bg-white/88 px-3 py-2 text-sm text-[#3b291d] outline-none transition-colors placeholder:text-[#8d755c] focus:border-[#a97748]"
      />
      {controls ? controls : null}
    </div>
  )
}
