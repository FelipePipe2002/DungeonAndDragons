package com.sistema.dnd.sistema.dto.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SavedPageUpsertRequest(
    @NotBlank(message = "El titulo es obligatorio")
    @Size(max = 200, message = "El titulo debe tener como maximo 200 caracteres")
    String titulo,

    @NotBlank(message = "La URL es obligatoria")
    String url,

    String selector
) {
}
