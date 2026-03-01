package com.sistema.dnd.sistema.dto.domain;

import com.sistema.dnd.sistema.entity.LandmarkType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.List;

public record LandmarkUpsertRequest(
    String icono,
    @NotBlank(message = "El nombre del landmark es obligatorio")
    String nombre,
    @NotNull(message = "El tipo del landmark es obligatorio")
    LandmarkType tipo,
    @NotNull(message = "escalaIcono es obligatoria")
    @DecimalMin(value = "0.6", message = "escalaIcono debe ser >= 0.6")
    @DecimalMax(value = "2.4", message = "escalaIcono debe ser <= 2.4")
    Double escalaIcono,
    @NotNull(message = "escalaTexto es obligatoria")
    @DecimalMin(value = "0.6", message = "escalaTexto debe ser >= 0.6")
    @DecimalMax(value = "2.4", message = "escalaTexto debe ser <= 2.4")
    Double escalaTexto,
    @NotNull(message = "mostrarLeyenda es obligatoria")
    Boolean mostrarLeyenda,
    @NotNull(message = "posicion es obligatoria")
    @Size(min = 2, max = 2, message = "posicion debe tener [x, y]")
    List<@NotNull @DecimalMin(value = "0.0") @DecimalMax(value = "1.0") Double> posicion,
    List<String> tags,
    @PositiveOrZero(message = "poblacion debe ser >= 0")
    Integer poblacion,
    String descripcionCorta,
    String historia,
    List<@Valid LandmarkEventRequest> eventos,
    @PositiveOrZero(message = "mapRotationDegrees debe ser >= 0")
    Integer mapRotationDegrees,
    Boolean mapGridEnabled,
    @PositiveOrZero(message = "mapGridCellSize debe ser >= 0")
    Double mapGridCellSize,
    Double mapGridOffsetX,
    Double mapGridOffsetY,
    @Valid LandmarkMapRequest mapa,
    Long mapAssetId
) {
}
