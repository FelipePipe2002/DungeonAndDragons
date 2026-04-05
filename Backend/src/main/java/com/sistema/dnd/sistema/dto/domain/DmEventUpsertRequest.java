package com.sistema.dnd.sistema.dto.domain;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record DmEventUpsertRequest(
    @Size(max = 200, message = "El titulo no puede tener mas de 200 caracteres")
    String titulo,

    @NotNull(message = "La descripcion del evento es obligatoria")
    String descripcion
) {
}
