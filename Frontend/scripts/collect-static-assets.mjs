import { access, cp, mkdir, rm } from "node:fs/promises"
import path from "node:path"

const rootDir = process.cwd()
const staticSourceDir = path.join(rootDir, ".next", "static")
const publicSourceDir = path.join(rootDir, "public")
const outputDir = path.join(rootDir, "deploy-static")

async function assertPathExists(targetPath, label) {
  try {
    await access(targetPath)
  } catch {
    throw new Error(`No se encontro ${label}: ${targetPath}. Ejecuta primero npm run build.`)
  }
}

async function main() {
  await assertPathExists(staticSourceDir, ".next/static")
  await assertPathExists(publicSourceDir, "public")

  await rm(outputDir, { recursive: true, force: true })
  await mkdir(path.join(outputDir, "_next"), { recursive: true })

  await cp(staticSourceDir, path.join(outputDir, "_next", "static"), { recursive: true })
  await cp(publicSourceDir, outputDir, { recursive: true })

  console.log("Assets generados en:", outputDir)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
