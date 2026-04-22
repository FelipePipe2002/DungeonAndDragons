package com.sistema.dnd.sistema.dto.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SubdivisionUpsertRequest(
    @NotNull(message = "estadoId es obligatorio")
    Long estadoId,
    @NotBlank(message = "El nombre de la subdivision es obligatorio")
    @Size(max = 200, message = "El nombre de la subdivision debe tener max 200 caracteres")
    String nombre,
    @NotBlank(message = "El tipo de la subdivision es obligatorio")
    @Size(max = 120, message = "El tipo de la subdivision debe tener max 120 caracteres")
    String tipo
) {
}
