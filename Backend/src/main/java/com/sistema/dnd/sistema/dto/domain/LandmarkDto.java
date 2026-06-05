package com.sistema.dnd.sistema.dto.domain;

import java.util.List;

public record LandmarkDto(
    Long id,
    String icon,
    String name,
    String type,
    Long stateId,
    Long subdivisionId,
    Double iconScale,
    Double textScale,
    Boolean showLegend,
    List<Double> position,
    List<String> tags,
    Integer population,
    String shortDescription,
    String history,
    List<EventDto> events,
    Long mapAssetId,
    String mapAssetKind,
    Integer mapRotationDegrees,
    Boolean mapGridEnabled,
    Double mapGridCellSize,
    Double mapGridOffsetX,
    Double mapGridOffsetY,
    String organizationMapLinks,
    String hiddenMapBuildings,
    String dungeonGeneratorConfig,
    LandmarkMapDto map,
    List<BuildingDto> buildings,
    List<CharacterDto> characters,
    List<OrganizationDto> organizations
) {
}
