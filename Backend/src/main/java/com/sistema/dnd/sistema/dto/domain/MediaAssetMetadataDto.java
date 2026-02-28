package com.sistema.dnd.sistema.dto.domain;

import java.time.OffsetDateTime;

public record MediaAssetMetadataDto(
    Long id,
    String kind,
    String filename,
    String contentType,
    Long byteSize,
    String downloadUrl,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
}
