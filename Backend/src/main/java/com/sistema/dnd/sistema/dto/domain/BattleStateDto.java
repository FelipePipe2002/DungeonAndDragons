package com.sistema.dnd.sistema.dto.domain;

import java.util.List;

public record BattleStateDto(
    Long id,
    String slug,
    String landmarkSlug,
    Integer nextTokenNumber,
    List<BattleTokenData> tokens,
    Integer nextObstacleId,
    List<BattleObstacleData> obstacles
) {
}
