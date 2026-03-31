package com.sistema.dnd.sistema.dto.domain;

import java.time.OffsetDateTime;
import java.util.List;

public record BattleStateDto(
    Long id,
    String slug,
    String sceneType,
    String sceneSlug,
    String parentLandmarkSlug,
    String title,
    String status,
    Integer roundNumber,
    String dmNotes,
    Integer nextTokenNumber,
    Integer currentTurnTokenNumber,
    List<BattleTokenData> tokens,
    Integer nextObstacleId,
    List<BattleObstacleData> obstacles,
    Boolean fogEnabled,
    Integer nextFogRevealId,
    List<BattleFogRevealData> fogReveals,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    OffsetDateTime endedAt
) {
}
