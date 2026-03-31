package com.sistema.dnd.sistema.dto.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public record BuildingUpsertRequest(
    Long landmarkId,
    @NotBlank(message = "El nombre del edificio es obligatorio")
    String nombre,
    @Size(min = 2, max = 2, message = "posicion debe tener [x, y]")
    List<Double> posicion,
    String descripcion,
    List<String> tags,
    Long duenoId,
    Integer mapBuildingIndex,
    Long organizationId,
    Long mapAssetId,
    Integer mapRotationDegrees,
    Boolean mapGridEnabled,
    Double mapGridCellSize,
    Double mapGridOffsetX,
    Double mapGridOffsetY,
    LandmarkMapRequest mapa
) {
}
