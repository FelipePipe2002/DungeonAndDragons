package com.sistema.dnd.sistema.dto.domain;

import java.util.List;

public record OrganizationDto(
    Long id,
    String nombre,
    String descripcion,
    List<String> tags,
    String imagen,
    Long imagenAssetId,
    List<String> categorias,
    List<Long> edificios,
    List<OrganizationMemberDto> miembros,
    List<Long> landmarks
) {
}
