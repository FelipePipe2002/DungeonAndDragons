package com.sistema.dnd.sistema.dto.domain;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record EstadoMemberRequest(
    @NotNull(message = "personajeId es obligatorio")
    Long personajeId,
    @Size(max = 120, message = "El rol debe tener max 120 caracteres")
    String rol
) {
}
