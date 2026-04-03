package com.sistema.dnd.sistema.dto.domain;

import java.util.List;

public record LandmarkDto(
    Long id,
    String icono,
    String nombre,
    String tipo,
    Double escalaIcono,
    Double escalaTexto,
    Boolean mostrarLeyenda,
    List<Double> posicion,
    List<String> tags,
    Integer poblacion,
    String descripcionCorta,
    String historia,
    List<LandmarkEventDto> eventos,
    Long mapAssetId,
    String mapAssetKind,
    Integer mapRotationDegrees,
    Boolean mapGridEnabled,
    Double mapGridCellSize,
    Double mapGridOffsetX,
    Double mapGridOffsetY,
    String organizationMapLinks,
    String hiddenMapBuildings,
    LandmarkMapDto mapa,
    List<BuildingDto> edificios,
    List<CharacterDto> personajes,
    List<OrganizationDto> organizaciones
) {
}
