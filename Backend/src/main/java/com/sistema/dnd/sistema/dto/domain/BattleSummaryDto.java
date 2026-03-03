package com.sistema.dnd.sistema.dto.domain;

import java.time.OffsetDateTime;

public record BattleSummaryDto(
    Long id,
    String slug,
    String landmarkSlug,
    String status,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    OffsetDateTime endedAt,
    Integer tokenCount,
    Integer obstacleCount
) {
}
