package com.sistema.dnd.sistema.dto.domain;

import java.util.List;

public record UpdateBattleStateRequest(
    String title,
    Integer roundNumber,
    String dmNotes,
    Integer nextTokenNumber,
    Integer currentTurnTokenNumber,
    List<BattleTokenData> tokens,
    Integer nextObstacleId,
    List<BattleObstacleData> obstacles,
    Boolean fogEnabled,
    Integer nextFogRevealId,
    List<BattleFogRevealData> fogReveals
) {
}
