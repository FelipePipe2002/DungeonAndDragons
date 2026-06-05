package com.sistema.dnd.sistema.dto.domain;

import com.sistema.dnd.sistema.entity.enums.LandmarkType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.List;

public record LandmarkUpsertRequest(
    String icon,
    @NotBlank(message = "name es obligatorio")
    String name,
    @NotNull(message = "type es obligatorio")
    LandmarkType type,
    Long stateId,
    Long subdivisionId,
    @NotNull(message = "iconScale es obligatorio")
    @DecimalMin(value = "0.6", message = "iconScale debe ser >= 0.6")
    @DecimalMax(value = "2.4", message = "iconScale debe ser <= 2.4")
    Double iconScale,
    @NotNull(message = "textScale es obligatorio")
    @DecimalMin(value = "0.6", message = "textScale debe ser >= 0.6")
    @DecimalMax(value = "2.4", message = "textScale debe ser <= 2.4")
    Double textScale,
    @NotNull(message = "showLegend es obligatorio")
    Boolean showLegend,
    @NotNull(message = "position es obligatoria")
    @Size(min = 2, max = 2, message = "position debe tener [x, y]")
    List<@NotNull @DecimalMin(value = "0.0") @DecimalMax(value = "1.0") Double> position,
    List<String> tags,
    @PositiveOrZero(message = "population debe ser >= 0")
    Integer population,
    String shortDescription,
    String history,
    List<@Valid EventDto> events,
    @PositiveOrZero(message = "mapRotationDegrees debe ser >= 0")
    Integer mapRotationDegrees,
    Boolean mapGridEnabled,
    @PositiveOrZero(message = "mapGridCellSize debe ser >= 0")
    Double mapGridCellSize,
    Double mapGridOffsetX,
    Double mapGridOffsetY,
    String organizationMapLinks,
    String hiddenMapBuildings,
    String dungeonGeneratorConfig,
    @Valid LandmarkMapRequest map,
    Long mapAssetId
) {
}
