package com.sistema.dnd.sistema.dto.domain;

import java.time.OffsetDateTime;

public record DmEventDto(
    Long id,
    String titulo,
    String descripcion,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
}
