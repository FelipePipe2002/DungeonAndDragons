package com.sistema.dnd.sistema.dto.domain;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record OrganizationUpsertRequest(
    @NotBlank(message = "name es obligatorio")
    String name,
    String description,
    List<String> tags,
    String image,
    Long imageAssetId,
    List<Long> buildingIds,
    List<@Valid OrganizationMemberRequest> members,
    List<Long> landmarks
) {
}
