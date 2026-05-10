package com.sistema.dnd.sistema.dto.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record BattleObstacleData(
    Integer id,
    String shape,
    Double x,
    Double y,
    Double width,
    Double height,
    Integer rotation,
    String color,
    String name,
    String image,
    Integer imageAssetId,
    Boolean hidden
) {
}
