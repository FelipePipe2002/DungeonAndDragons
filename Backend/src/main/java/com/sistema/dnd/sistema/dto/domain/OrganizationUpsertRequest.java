package com.sistema.dnd.sistema.dto.domain;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record OrganizationUpsertRequest(
    @NotBlank(message = "El nombre de la organizacion es obligatorio")
    String nombre,
    String descripcion,
    List<String> tags,
    String imagen,
    Long imagenAssetId,
    List<String> categorias,
    List<Long> edificios,
    List<@Valid OrganizationMemberRequest> miembros,
    List<Long> landmarks
) {
}
