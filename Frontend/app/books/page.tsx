import { readdir } from "node:fs/promises"
import path from "node:path"
import Link from "next/link"
import { BookOpen, ExternalLink } from "lucide-react"

import { Button } from "@/components/ui/button"

type SearchParams = {
  libro?: string | string[]
}

type BookFile = {
  filename: string
  title: string
  publicUrl: string
}

const BOOKS_DIR = path.join(process.cwd(), "public", "books")

const SUPPORTED_EXTENSIONS = new Set([".pdf", ".epub", ".txt", ".md"])

function getReadableBookTitle(filename: string) {
  const extension = path.extname(filename)
  const baseName = filename.slice(0, filename.length - extension.length)

  return baseName
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function toPublicBookUrl(filename: string) {
  return `/books/${encodeURIComponent(filename)}`
}

function normalizeSelectedBook(rawValue: string | string[] | undefined) {
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue
  if (!value) return null
  const normalized = value.trim()
  if (!normalized) return null

  try {
    return decodeURIComponent(normalized)
  } catch {
    return normalized
  }
}

async function getBookFiles(): Promise<BookFile[]> {
  try {
    const entries = await readdir(BOOKS_DIR, { withFileTypes: true })

    return entries
      .filter((entry) => entry.isFile())
      .filter((entry) => SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => ({
        filename: entry.name,
        title: getReadableBookTitle(entry.name),
        publicUrl: toPublicBookUrl(entry.name),
      }))
      .sort((a, b) => a.title.localeCompare(b.title, "es"))
  } catch {
    return []
  }
}

interface BooksPageProps {
  searchParams: Promise<SearchParams>
}

export default async function BooksPage({ searchParams }: BooksPageProps) {
  const [books, params] = await Promise.all([getBookFiles(), searchParams])
  const selectedFilename = normalizeSelectedBook(params.libro)
  const selectedBook = books.find((book) => book.filename === selectedFilename) ?? books[0] ?? null

  return (
    <div className="mx-auto w-full max-w-[2200px] px-4 py-6 md:px-6 md:py-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-sm border-2 border-primary/30 bg-primary/10">
            <BookOpen className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-serif text-primary">Libros</h1>
            <p className="text-sm text-muted-foreground">
              {books.length} libros disponibles en tu biblioteca local
            </p>
          </div>
        </div>
        <div className="ornament-divider mt-4">~</div>
      </div>

      {books.length === 0 ? (
        <div className="rounded-sm border border-border bg-card p-5 text-sm text-muted-foreground">
          No se encontraron libros en `public/books`.
        </div>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-2.5">
            {books.map((book) => {
              const isSelected = selectedBook?.filename === book.filename

              return (
                <Button key={book.filename} variant={isSelected ? "default" : "outline"} asChild>
                  <Link href={`/books?libro=${encodeURIComponent(book.filename)}`}>
                    <BookOpen className="size-4" />
                    <span className="max-w-[250px] truncate">{book.title}</span>
                  </Link>
                </Button>
              )
            })}
          </div>

          {selectedBook && (
            <>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-serif text-xl text-foreground">{selectedBook.title}</h2>
                <a
                  href={selectedBook.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  Abrir en otra pestana
                  <ExternalLink className="size-3.5" />
                </a>
              </div>

              <div className="h-[90vh] min-h-[560px] md:h-[86vh] md:min-h-[900px] overflow-hidden rounded-sm border border-border bg-card">
                <iframe
                  src={selectedBook.publicUrl}
                  title={`Lector de ${selectedBook.title}`}
                  className="size-full"
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
