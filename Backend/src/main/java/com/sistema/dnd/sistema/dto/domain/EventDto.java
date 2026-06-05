package com.sistema.dnd.sistema.dto.domain;

import jakarta.validation.constraints.NotBlank;

public record EventDto(
    Long id,

    @NotBlank(message = "title es obligatorio")
    String title,
    String description,
    String date,
    String session
) {
}
