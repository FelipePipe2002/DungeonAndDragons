package com.sistema.dnd.sistema.dto.domain;

import jakarta.validation.constraints.NotNull;

public record OrganizationMemberRequest(
    @NotNull(message = "personajeId es obligatorio")
    Long personajeId,
    String categoria
) {
}
