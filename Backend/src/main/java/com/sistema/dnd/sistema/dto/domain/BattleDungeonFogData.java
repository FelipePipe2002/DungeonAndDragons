package com.sistema.dnd.sistema.dto.domain;

import java.util.List;

public record BattleDungeonFogData(
    Boolean enabled,
    List<String> exploredCellKeys,
    List<String> openDoorIds,
    Integer playerVisionBrightRadiusCells,
    Integer playerVisionDimRadiusCells
) {
}
