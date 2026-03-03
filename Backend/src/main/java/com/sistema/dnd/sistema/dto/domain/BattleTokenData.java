package com.sistema.dnd.sistema.dto.domain;

public record BattleTokenData(
    Integer number,
    String nombre,
    Integer characterId,
    String type,
    Double x,
    Double y,
    Integer initiative,
    Integer life,
    Double size,
    String status,
    Boolean hidden
) {
    public BattleTokenData(
        Integer number,
        String nombre,
        Integer characterId,
        String type,
        Double x,
        Double y,
        Integer initiative,
        Integer life,
        Double size,
        String status
    ) {
        this(number, nombre, characterId, type, x, y, initiative, life, size, status, null);
    }

    public BattleTokenData(
        Integer number,
        String nombre,
        String type,
        Double x,
        Double y,
        Integer initiative,
        Integer life,
        Double size,
        String status,
        Boolean hidden
    ) {
        this(number, nombre, null, type, x, y, initiative, life, size, status, hidden);
    }
}
