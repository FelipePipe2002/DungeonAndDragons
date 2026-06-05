package com.sistema.dnd.sistema.dto.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SavedPageDto(
    Long id,

    @NotBlank(message = "title es obligatorio")
    @Size(max = 200, message = "title debe tener como maximo 200 caracteres")
    String title,

    @NotBlank(message = "La URL es obligatoria")
    String url,
    String selector
) {
}
