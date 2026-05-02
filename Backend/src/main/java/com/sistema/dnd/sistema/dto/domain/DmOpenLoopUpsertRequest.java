package com.sistema.dnd.sistema.dto.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
public record DmOpenLoopUpsertRequest(
    @NotBlank(message = "El titulo es obligatorio")
    @Size(max = 200, message = "El titulo no puede tener mas de 200 caracteres")
    String title,

    @NotBlank(message = "El tipo es obligatorio")
    @Size(max = 30, message = "El tipo no puede tener mas de 30 caracteres")
    String loopType,

    @NotBlank(message = "El estado es obligatorio")
    @Size(max = 20, message = "El estado no puede tener mas de 20 caracteres")
    String status,

    @NotBlank(message = "La prioridad es obligatoria")
    @Size(max = 20, message = "La prioridad no puede tener mas de 20 caracteres")
    String priority,

    @NotBlank(message = "El resumen es obligatorio")
    String summary,

    String nextStep,
    String consequence,
    String reward,

    @Size(max = 120, message = "La ubicacion no puede tener mas de 120 caracteres")
    String location,

    @Size(max = 200, message = "La fecha limite no puede tener mas de 200 caracteres")
    String dueAt,
    String notes
) {
}
