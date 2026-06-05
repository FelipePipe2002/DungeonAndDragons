package com.sistema.dnd.sistema.dto.domain;

public record PartyInventoryItemDto(
    Long id,
    String kind,
    String name,
    Integer quantity,
    Long carrierCharacterId,
    String carriedBy,
    boolean important,
    String notes,
    String sourceItemName,
    String sourceItemTypeCode
) {
}
