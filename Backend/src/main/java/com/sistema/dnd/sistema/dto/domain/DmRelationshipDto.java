package com.sistema.dnd.sistema.dto.domain;

import java.time.OffsetDateTime;

public record DmRelationshipDto(
    Long id,
    String leftEntityType,
    Long leftEntityId,
    String rightEntityType,
    Long rightEntityId,
    String direction,
    String label,
    String notes,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
}
