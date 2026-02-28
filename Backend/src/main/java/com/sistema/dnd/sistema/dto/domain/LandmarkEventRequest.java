package com.sistema.dnd.sistema.dto.domain;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record LandmarkEventRequest(
    @NotBlank(message = "El nombre del evento es obligatorio")
    String nombre,
    String descripcion,
    String fecha,
    List<Double> posicion
) {
}
