package com.sistema.dnd.sistema.dto.domain;

import java.util.List;

public record BuildingDto(
    Long id,
    Long landmarkId,
    String name,
    List<Double> position,
    String description,
    List<String> tags,
    Long ownerId,
    Integer mapBuildingIndex,
    Long organizationId,
    Long mapAssetId,
    String mapAssetKind,
    Integer mapRotationDegrees,
    Boolean mapGridEnabled,
    Double mapGridCellSize,
    Double mapGridOffsetX,
    Double mapGridOffsetY,
    LandmarkMapDto map
) {
}
