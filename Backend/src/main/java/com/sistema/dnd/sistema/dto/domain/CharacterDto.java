package com.sistema.dnd.sistema.dto.domain;

import java.util.List;

public record CharacterDto(
    Long id,
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
    List<EventDto> events
) {
}
