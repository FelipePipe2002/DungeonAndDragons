package com.sistema.dnd.sistema.dto.domain;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public record EstadoUpsertRequest(
    @NotBlank(message = "name es obligatorio")
    @Size(max = 200, message = "name debe tener max 200 caracteres")
    String name,
    @NotBlank(message = "type es obligatorio")
    @Size(max = 120, message = "type debe tener max 120 caracteres")
    String type,
    String description,
    String history,
    @Size(max = 120, message = "governmentType debe tener max 120 caracteres")
    String governmentType,
    String image,
    Long imageAssetId,
    String territoryImage,
    Long territoryImageAssetId,
    Long parentStateId,
    List<@Valid EstadoMemberDto> members,
    List<@Valid EstadoLandmarkRoleDto> landmarks
) {
}
