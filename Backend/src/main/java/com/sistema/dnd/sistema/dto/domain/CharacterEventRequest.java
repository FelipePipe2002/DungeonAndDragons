package com.sistema.dnd.sistema.dto.domain;

import jakarta.validation.constraints.NotBlank;

public record CharacterEventRequest(
    @NotBlank(message = "La sesion es obligatoria")
    String sesion,
    String descripcion,
    String fecha
) {
}
