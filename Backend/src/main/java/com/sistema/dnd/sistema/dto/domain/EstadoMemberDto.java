package com.sistema.dnd.sistema.dto.domain;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record EstadoMemberDto(
    @NotNull(message = "characterId es obligatorio")
    Long characterId,

    @Size(max = 120, message = "role debe tener max 120 caracteres")
    String role
) {
}
