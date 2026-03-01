package com.sistema.dnd.sistema.dto.domain;

import java.time.OffsetDateTime;

public record SavedPageDto(
    Long id,
    String titulo,
    String url,
    String selector,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
}
