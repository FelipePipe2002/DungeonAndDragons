package com.sistema.dnd.sistema.dto.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record DmRelationshipUpsertRequest(
    @NotBlank(message = "El tipo de entidad izquierda es obligatorio")
    @Size(max = 30, message = "El tipo de entidad izquierda no puede tener mas de 30 caracteres")
    String leftEntityType,

    @NotNull(message = "La entidad izquierda es obligatoria")
    @Positive(message = "La entidad izquierda debe ser valida")
    Long leftEntityId,

    @NotBlank(message = "El tipo de entidad derecha es obligatorio")
    @Size(max = 30, message = "El tipo de entidad derecha no puede tener mas de 30 caracteres")
    String rightEntityType,

    @NotNull(message = "La entidad derecha es obligatoria")
    @Positive(message = "La entidad derecha debe ser valida")
    Long rightEntityId,

    @NotBlank(message = "La direccion es obligatoria")
    @Size(max = 20, message = "La direccion no puede tener mas de 20 caracteres")
    String direction,

    @NotBlank(message = "La etiqueta es obligatoria")
    @Size(max = 120, message = "La etiqueta no puede tener mas de 120 caracteres")
    String label,

    String notes
) {
}
