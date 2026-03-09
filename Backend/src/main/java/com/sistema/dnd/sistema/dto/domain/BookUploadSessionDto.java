package com.sistema.dnd.sistema.dto.domain;

import java.time.OffsetDateTime;

public record BookUploadSessionDto(
    String sessionId,
    String status,
    Integer progressPercent,
    Long processedBytes,
    Long totalBytes,
    Long bookId,
    String filename,
    String errorMessage,
    OffsetDateTime updatedAt
) {
}
