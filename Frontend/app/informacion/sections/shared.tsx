export const BOOK_FILE_ACCEPT =
  ".pdf,.epub,.txt,.md,application/pdf,application/epub+zip,text/plain,text/markdown"

export function formatByteSize(byteSize: number) {
  if (!Number.isFinite(byteSize) || byteSize <= 0) {
    return "0 B"
  }

  if (byteSize < 1024) {
    return `${byteSize} B`
  }

  const units = ["KB", "MB", "GB"]
  let value = byteSize / 1024
  let index = 0

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`
}
