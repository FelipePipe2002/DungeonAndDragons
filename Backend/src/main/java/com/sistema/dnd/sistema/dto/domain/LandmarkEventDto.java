package com.sistema.dnd.sistema.dto.domain;

import java.util.List;

public record LandmarkEventDto(
    String nombre,
    String descripcion,
    String fecha,
    List<Double> posicion
) {
}
