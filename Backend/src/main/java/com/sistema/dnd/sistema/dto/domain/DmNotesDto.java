package com.sistema.dnd.sistema.dto.domain;

import jakarta.validation.constraints.NotNull;

public record DmNotesDto(
    @NotNull(message = "text es obligatorio")
    String text
) {
}
