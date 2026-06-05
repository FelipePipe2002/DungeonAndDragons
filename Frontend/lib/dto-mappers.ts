import { toOptionalText } from "@/lib/normalize"
import type {
  BackendCharacterEventDto,
  BackendOrganizationMemberDto,
  CharacterEvent,
  OrganizationMember,
} from "@/lib/types"

export function toStringArray(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

export function toNumberArray(value: number[] | null | undefined): number[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is number => typeof item === "number" && Number.isFinite(item))
}

export function toPosition(value: number[] | null | undefined): [number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined
  const x = Number(value[0])
  const y = Number(value[1])
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined
  return [x, y]
}

export function toCharacterEvent(event: BackendCharacterEventDto): CharacterEvent {
  return {
    sesion: event.session ?? "",
    descripcion: event.description ?? "",
    fecha: toOptionalText(event.date),
  }
}

export function toOrganizationMember(dto: BackendOrganizationMemberDto): OrganizationMember {
  const characterId =
    typeof dto.characterId === "number" && Number.isFinite(dto.characterId) ? dto.characterId : 0

  return {
    personajeId: characterId,
    nombre: toOptionalText(dto.name) ?? `Miembro ${characterId}`,
    profesion: toOptionalText(dto.profession) ?? "",
    raza: toOptionalText(dto.race) ?? "",
    landmarkId: typeof dto.landmarkId === "number" && Number.isFinite(dto.landmarkId) ? dto.landmarkId : 0,
    categoria: toOptionalText(dto.category) ?? "",
  }
}
