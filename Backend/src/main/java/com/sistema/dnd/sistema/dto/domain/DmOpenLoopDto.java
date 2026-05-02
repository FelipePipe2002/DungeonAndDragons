package com.sistema.dnd.sistema.dto.domain;

import java.time.OffsetDateTime;

public record DmOpenLoopDto(
    Long id,
    String title,
    String loopType,
    String status,
    String priority,
    String summary,
    String nextStep,
    String consequence,
    String reward,
    String location,
    String dueAt,
    String notes,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt
) {
}
