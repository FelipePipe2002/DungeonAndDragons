package com.sistema.dnd.sistema.dto.domain;

public record BattleTokenData(
    Integer number,
    String nombre,
    Integer characterId,
    String sourceType,
    String sourceRef,
    String image,
    Long imageAssetId,
    Double imageFocusX,
    Double imageFocusY,
    Double imageZoom,
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
        String sourceType,
        String sourceRef,
        String image,
        Long imageAssetId,
        Double imageFocusX,
        Double imageFocusY,
        Double imageZoom,
        String type,
        Double x,
        Double y,
        Integer initiative,
        Integer life,
        Double size,
        String status
    ) {
        this(
            number,
            nombre,
            characterId,
            sourceType,
            sourceRef,
            image,
            imageAssetId,
            imageFocusX,
            imageFocusY,
            imageZoom,
            type,
            x,
            y,
            initiative,
            life,
            size,
            status,
            null
        );
    }

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
        this(number, nombre, characterId, null, null, null, null, null, null, null, type, x, y, initiative, life, size, status, null);
    }

    public BattleTokenData(
        Integer number,
        String nombre,
        Integer characterId,
        String sourceType,
        String sourceRef,
        String type,
        Double x,
        Double y,
        Integer initiative,
        Integer life,
        Double size,
        String status,
        Boolean hidden
    ) {
        this(number, nombre, characterId, sourceType, sourceRef, null, null, null, null, null, type, x, y, initiative, life, size, status, hidden);
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
        this(number, nombre, null, null, null, null, null, null, null, null, type, x, y, initiative, life, size, status, hidden);
    }
}
