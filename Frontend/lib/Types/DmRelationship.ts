export type DmRelationshipEntityType = "character" | "building" | "organization" | "landmark"

export type DmRelationshipDirection = "left-to-right" | "right-to-left" | "both"

export interface DmRelationship {
  id: number
  leftEntityType: DmRelationshipEntityType
  leftEntityId: number
  rightEntityType: DmRelationshipEntityType
  rightEntityId: number
  direction: DmRelationshipDirection
  label: string
  notes?: string
  createdAt?: string
  updatedAt?: string
}

export interface DmRelationshipInput {
  leftEntityType: DmRelationshipEntityType
  leftEntityId: number
  rightEntityType: DmRelationshipEntityType
  rightEntityId: number
  direction: DmRelationshipDirection
  label: string
  notes?: string
}
