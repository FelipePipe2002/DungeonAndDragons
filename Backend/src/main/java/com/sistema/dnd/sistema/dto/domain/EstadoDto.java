package com.sistema.dnd.sistema.dto.domain;

import java.util.List;

public record EstadoDto(
    Long id,
    String nombre,
    String tipo,
    String descripcion,
    String historia,
    String gobiernoTipo,
    String imagen,
    Long imagenAssetId,
    String territorioImagen,
    Long territorioImagenAssetId,
    Long estadoPadreId,
    List<EstadoMemberDto> miembros,
    List<EstadoLandmarkRoleDto> landmarks,
    List<String> subdivisiones
) {
}
