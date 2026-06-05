package com.sistema.dnd.sistema.dto.domain;

import com.sistema.dnd.sistema.entity.enums.LandmarkMapKind;
import com.sistema.dnd.sistema.entity.enums.LandmarkMapSource;
import jakarta.validation.constraints.NotNull;

public record LandmarkMapRequest(
    @NotNull(message = "mapa.kind es obligatorio")
    LandmarkMapKind kind,
    LandmarkMapSource source,
    String filename,
    String url,
    String key,
    String dataUrl
) {
}
