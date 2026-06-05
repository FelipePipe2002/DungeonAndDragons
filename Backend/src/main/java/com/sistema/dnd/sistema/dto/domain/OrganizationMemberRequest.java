package com.sistema.dnd.sistema.dto.domain;

import jakarta.validation.constraints.NotNull;

public record OrganizationMemberRequest(
    @NotNull(message = "characterId es obligatorio")
    Long characterId,
    String category
) {
}
