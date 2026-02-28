package com.sistema.dnd.sistema.dto.domain;

public record OrganizationMemberDto(
    Long personajeId,
    String nombre,
    String profesion,
    String raza,
    Long landmarkId,
    String categoria
) {
}
