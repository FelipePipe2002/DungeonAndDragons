export type EstadoId = number

export type EstadoMemberRole = {
  personajeId: number
  rol: string
}

export type EstadoLandmarkRole = {
  landmarkId: number
  rol: string
}

export interface Estado {
  id: EstadoId
  nombre: string
  tipo: string
  descripcion: string
  historia: string
  gobiernoTipo: string
  imagen?: string
  imagenAssetId?: number
  territorioImagen?: string
  territorioImagenAssetId?: number
  estadoPadreId?: number
  miembros: EstadoMemberRole[]
  landmarks: EstadoLandmarkRole[]
  subdivisiones: string[]
}
