package com.sistema.dnd.sistema.dto.domain;

import java.util.List;

public record BuildingDto(
    Long id,
    Long landmarkId,
    String nombre,
    List<Double> posicion,
    String descripcion,
    List<String> tags,
    Long duenoId,
    Integer mapBuildingIndex,
    Long organizationId
) {
}
