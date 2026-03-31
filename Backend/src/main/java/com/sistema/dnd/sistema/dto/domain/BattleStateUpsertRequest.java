package com.sistema.dnd.sistema.dto.domain;

import java.util.List;

@Deprecated(since = "2026-03", forRemoval = false)
// Legacy payload kept only for the deprecated /v1/battle/current endpoint.
public record BattleStateUpsertRequest(
    String landmarkSlug,
    Integer nextTokenNumber,
    Integer currentTurnTokenNumber,
    List<BattleTokenData> tokens,
    Integer nextObstacleId,
    List<BattleObstacleData> obstacles,
    Boolean fogEnabled,
    Integer nextFogRevealId,
    List<BattleFogRevealData> fogReveals
) {
}
