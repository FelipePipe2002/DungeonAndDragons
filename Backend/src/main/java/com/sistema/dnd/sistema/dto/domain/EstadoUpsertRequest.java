package com.sistema.dnd.sistema.dto.domain;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

public record EstadoUpsertRequest(
    @NotBlank(message = "El nombre del estado es obligatorio")
    @Size(max = 200, message = "El nombre del estado debe tener max 200 caracteres")
    String nombre,
    @NotBlank(message = "El tipo del estado es obligatorio")
    @Size(max = 120, message = "El tipo del estado debe tener max 120 caracteres")
    String tipo,
    String descripcion,
    String historia,
    @Size(max = 120, message = "El tipo de gobierno debe tener max 120 caracteres")
    String gobiernoTipo,
    String imagen,
    Long imagenAssetId,
    String territorioImagen,
    Long territorioImagenAssetId,
    Long estadoPadreId,
    List<EstadoMemberRequest> miembros,
    List<EstadoLandmarkRoleRequest> landmarks,
    List<String> subdivisiones
) {
}
