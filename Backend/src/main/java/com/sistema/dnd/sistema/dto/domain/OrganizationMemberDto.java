package com.sistema.dnd.sistema.dto.domain;

public record OrganizationMemberDto(
    Long characterId,
    String name,
    String profession,
    String race,
    Long landmarkId,
    String category
) {
}
