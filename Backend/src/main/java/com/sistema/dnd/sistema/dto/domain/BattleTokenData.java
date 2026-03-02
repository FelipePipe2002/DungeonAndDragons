package com.sistema.dnd.sistema.dto.domain;

public record BattleTokenData(
    Integer number,
    String nombre,
    String type,
    Double x,
    Double y,
    Integer initiative,
    Integer life,
    Double size,
    String status
) {
}
