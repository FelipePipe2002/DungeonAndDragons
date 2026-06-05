import type { BackendMonsterTokenImageResolveDto as MonsterTokenImageResolveDto } from "@/lib/types"
import { backendRequest } from "@/lib/services/backend-api.service"
import { backendRoutes } from "@/lib/services/backend-routes"

export type MonsterTokenImageResolution = {
  assetId?: number
  imageUrl?: string
  found: boolean
  source?: string
}

export async function resolveMonsterTokenImage(
  name: string,
  sources: string[],
): Promise<MonsterTokenImageResolution> {
  const response = await backendRequest<MonsterTokenImageResolveDto>(
    backendRoutes.monsterTokenImages.resolve(name, sources),
  )

  return {
    assetId:
      typeof response?.assetId === "number" && Number.isFinite(response.assetId) && response.assetId > 0
        ? response.assetId
        : undefined,
    imageUrl:
      typeof response?.downloadUrl === "string" && response.downloadUrl.trim().length > 0
        ? response.downloadUrl
        : undefined,
    found: response?.status === "resolved",
    source:
      typeof response?.matchedSource === "string" && response.matchedSource.trim().length > 0
        ? response.matchedSource
        : undefined,
  }
}
