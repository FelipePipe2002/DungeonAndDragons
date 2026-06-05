package com.sistema.dnd.sistema.dto.domain;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record PartyInventoryBalanceDto(
    @NotNull(message = "El cobre es obligatorio")
    @Min(value = 0, message = "El cobre no puede ser negativo")
    Long copper,

    @NotNull(message = "La plata es obligatoria")
    @Min(value = 0, message = "La plata no puede ser negativa")
    Long silver,

    @NotNull(message = "El oro es obligatorio")
    @Min(value = 0, message = "El oro no puede ser negativo")
    Long gold,

    @NotNull(message = "El platino es obligatorio")
    @Min(value = 0, message = "El platino no puede ser negativo")
    Long platinum
) {
}
