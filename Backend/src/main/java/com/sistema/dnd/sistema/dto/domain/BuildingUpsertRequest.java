package com.sistema.dnd.sistema.dto.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public record BuildingUpsertRequest(
    Long landmarkId,
    @NotBlank(message = "name es obligatorio")
    String name,
    @Size(min = 2, max = 2, message = "position debe tener [x, y]")
    List<Double> position,
    String description,
    List<String> tags,
    Long ownerId,
    Integer mapBuildingIndex,
    Long organizationId,
    Long mapAssetId,
    Integer mapRotationDegrees,
    Boolean mapGridEnabled,
    Double mapGridCellSize,
    Double mapGridOffsetX,
    Double mapGridOffsetY,
    LandmarkMapRequest map
) {
}
