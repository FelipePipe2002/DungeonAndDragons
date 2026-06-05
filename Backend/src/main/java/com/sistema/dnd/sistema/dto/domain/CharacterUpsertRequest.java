package com.sistema.dnd.sistema.dto.domain;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record CharacterUpsertRequest(
    @NotBlank(message = "name es obligatorio")
    String name,
    String characterClass,
    String race,
    String description,
    boolean isPlayer,
    CharacterSheetData characterSheet,
    List<String> tags,
    String image,
    Long imageAssetId,
    Double tokenImageFocusX,
    Double tokenImageFocusY,
    Double tokenImageZoom,
    Double initiativeImageFocusX,
    Double initiativeImageFocusY,
    Double initiativeImageZoom,
    Long landmarkId,
    List<Long> buildingIds,
    List<Long> organizationIds,
    List<@Valid EventDto> events
) {
}
