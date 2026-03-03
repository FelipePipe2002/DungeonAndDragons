package com.sistema.dnd.sistema.dto.domain;

import java.time.OffsetDateTime;
import java.util.List;

public record BattleStateDto(
    Long id,
    String slug,
    String landmarkSlug,
    String status,
    Integer nextTokenNumber,
    Integer currentTurnTokenNumber,
    List<BattleTokenData> tokens,
    Integer nextObstacleId,
    List<BattleObstacleData> obstacles,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    OffsetDateTime endedAt
) {
}
