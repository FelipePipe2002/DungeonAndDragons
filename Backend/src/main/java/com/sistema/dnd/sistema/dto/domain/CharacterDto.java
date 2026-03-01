package com.sistema.dnd.sistema.dto.domain;

import java.util.List;

public record CharacterDto(
    Long id,
    String nombre,
    String clase,
    String raza,
    String descripcion,
    boolean isPlayer,
    CharacterSheetData characterSheet,
    List<String> tags,
    String imagen,
    Long imagenAssetId,
    Long landmarkId,
    List<Long> buildingIds,
    List<Long> organizationIds,
    List<CharacterEventDto> eventos
) {
}
