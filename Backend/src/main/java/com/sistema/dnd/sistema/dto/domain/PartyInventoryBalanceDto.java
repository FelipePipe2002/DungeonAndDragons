package com.sistema.dnd.sistema.dto.domain;

import java.time.OffsetDateTime;

public record PartyInventoryBalanceDto(
    Long copper,
    Long silver,
    Long gold,
    Long platinum,
    OffsetDateTime updatedAt
) {
}
