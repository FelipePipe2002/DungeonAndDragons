package com.sistema.dnd.sistema.dto.domain;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record EstadoLandmarkRoleDto(
    @NotNull(message = "landmarkId es obligatorio")
    Long landmarkId,

    @Size(max = 120, message = "role debe tener max 120 caracteres")
    String role
) {
}
