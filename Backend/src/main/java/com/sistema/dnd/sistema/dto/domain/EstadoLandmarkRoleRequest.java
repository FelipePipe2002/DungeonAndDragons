package com.sistema.dnd.sistema.dto.domain;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record EstadoLandmarkRoleRequest(
    @NotNull(message = "landmarkId es obligatorio")
    Long landmarkId,
    @Size(max = 120, message = "El rol debe tener max 120 caracteres")
    String rol
) {
}
