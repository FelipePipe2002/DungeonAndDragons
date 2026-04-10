package com.sistema.dnd.sistema.dto.domain;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record PartyInventoryItemUpsertRequest(
    @NotBlank(message = "El tipo de item es obligatorio")
    @Size(max = 30, message = "El tipo de item no puede tener mas de 30 caracteres")
    String kind,

    @NotBlank(message = "El nombre es obligatorio")
    @Size(max = 200, message = "El nombre no puede tener mas de 200 caracteres")
    String name,

    @NotNull(message = "La cantidad es obligatoria")
    @Min(value = 1, message = "La cantidad debe ser al menos 1")
    Integer quantity,

    Long carrierCharacterId,

    @Size(max = 120, message = "El portador no puede tener mas de 120 caracteres")
    String carriedBy,

    @NotNull(message = "Debe indicarse si el item es importante")
    Boolean important,

    String notes,

    @Size(max = 200, message = "El nombre del item fuente no puede tener mas de 200 caracteres")
    String sourceItemName,

    @Size(max = 30, message = "El tipo del item fuente no puede tener mas de 30 caracteres")
    String sourceItemTypeCode
) {
}
