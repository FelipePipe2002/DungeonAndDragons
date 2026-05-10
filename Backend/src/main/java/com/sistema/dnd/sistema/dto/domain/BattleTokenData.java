package com.sistema.dnd.sistema.dto.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
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
    Integer statusDurationTurns,
    Boolean hidden
) {
}
