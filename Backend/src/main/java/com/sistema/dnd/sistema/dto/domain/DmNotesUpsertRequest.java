package com.sistema.dnd.sistema.dto.domain;

import jakarta.validation.constraints.NotNull;

public record DmNotesUpsertRequest(
    @NotNull(message = "El texto de las notas es obligatorio")
    String texto
) {
}
