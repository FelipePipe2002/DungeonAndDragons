package com.sistema.dnd.sistema.dto.domain;

import java.util.List;

public record BattleCenterHistoryDto(
    List<BattleSummaryDto> activeBattles,
    List<BattleSummaryDto> finishedBattles,
    int page,
    int pageSize,
    long totalFinishedBattles,
    int totalFinishedPages,
    boolean hasPreviousPage,
    boolean hasNextPage
) {
}
