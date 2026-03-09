package com.sistema.dnd.sistema.dto.domain;

public record MonsterTokenImageResolveDto(
    String status,
    Long assetId,
    String downloadUrl,
    String matchedSource
) {
}
