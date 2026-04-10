package com.sistema.dnd.sistema.dto.domain;

import java.util.List;

public record PartyInventoryDto(
    PartyInventoryBalanceDto balance,
    List<PartyInventoryItemDto> items
) {
}
