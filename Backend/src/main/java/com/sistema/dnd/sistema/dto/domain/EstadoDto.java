package com.sistema.dnd.sistema.dto.domain;

import java.util.List;

public record EstadoDto(
    Long id,
    String name,
    String type,
    String description,
    String history,
    String governmentType,
    String image,
    Long imageAssetId,
    String territoryImage,
    Long territoryImageAssetId,
    Long parentStateId,
    List<EstadoMemberDto> members,
    List<EstadoLandmarkRoleDto> landmarks
) {
}
