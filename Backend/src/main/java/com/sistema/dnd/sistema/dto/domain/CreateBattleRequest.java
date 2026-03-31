package com.sistema.dnd.sistema.dto.domain;

public record CreateBattleRequest(
    String sceneType,
    String sceneSlug,
    String parentLandmarkSlug
) {
}
