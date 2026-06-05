package com.sistema.dnd.sistema.dto.domain;

import java.util.List;

public record OrganizationDto(
    Long id,
    String name,
    String description,
    List<String> tags,
    String image,
    Long imageAssetId,
    List<String> categories,
    List<Long> buildingIds,
    List<OrganizationMemberDto> members,
    List<Long> landmarks
) {
}
