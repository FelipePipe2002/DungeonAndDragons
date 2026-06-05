import { StandaloneMapViewer } from "@/components/map/StandaloneMapViewer"
import { getLandmarkAssetsByFolder } from "@/lib/landmarks/assets.server"

const WORLD_MAP_URL = "/maps/world/chult-map.jpg"

export default async function MapaPage() {
  const folderAssets = await getLandmarkAssetsByFolder()

  return (
    <div className="mx-auto">
      <StandaloneMapViewer
        initialLandmarks={[]}
        mapImageUrl={WORLD_MAP_URL}
        initialFolderAssets={folderAssets}
      />
    </div>
  )
}
