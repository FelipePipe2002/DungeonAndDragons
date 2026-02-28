import "server-only"

import { promises as fs } from "node:fs"
import path from "node:path"

const LANDMARKS_DIR = path.join(process.cwd(), "public", "landmarks")
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif"])

function toPublicPath(folder: string, filename: string) {
  return `/landmarks/${folder}/${filename}`
}

export async function getLandmarkAssetsByFolder(): Promise<Record<string, string[]>> {
  try {
    const entries = await fs.readdir(LANDMARKS_DIR, { withFileTypes: true })
    const folders = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b))

    const result: Record<string, string[]> = {}

    await Promise.all(
      folders.map(async (folder) => {
        const folderPath = path.join(LANDMARKS_DIR, folder)
        const files = await fs.readdir(folderPath, { withFileTypes: true })
        result[folder] = files
          .filter((file) => file.isFile())
          .map((file) => file.name)
          .filter((filename) => IMAGE_EXTENSIONS.has(path.extname(filename).toLowerCase()))
          .sort((a, b) => a.localeCompare(b))
          .map((filename) => toPublicPath(folder, filename))
      }),
    )

    return result
  } catch {
    return {}
  }
}
