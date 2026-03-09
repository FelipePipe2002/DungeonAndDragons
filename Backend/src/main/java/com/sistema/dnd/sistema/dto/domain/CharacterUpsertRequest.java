package com.sistema.dnd.sistema.dto.domain;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record CharacterUpsertRequest(
    @NotBlank(message = "El nombre del personaje es obligatorio")
    String nombre,
    String clase,
    String raza,
    String descripcion,
    boolean isPlayer,
    CharacterSheetData characterSheet,
    List<String> tags,
    String imagen,
    Long imagenAssetId,
    Double tokenImageFocusX,
    Double tokenImageFocusY,
    Double tokenImageZoom,
    Double initiativeImageFocusX,
    Double initiativeImageFocusY,
    Double initiativeImageZoom,
    Long landmarkId,
    List<Long> buildingIds,
    List<Long> organizationIds,
    List<@Valid CharacterEventRequest> eventos
) {
}
