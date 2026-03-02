package com.sistema.dnd.sistema.dto.domain;

public record BattleObstacleData(
    Integer id,
    String shape,
    Double x,
    Double y,
    Double width,
    Double height,
    String color
) {
}
