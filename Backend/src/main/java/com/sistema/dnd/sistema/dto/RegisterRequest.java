package com.sistema.dnd.sistema.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record RegisterRequest(
    @NotBlank(message = "Email requerido")
    @Email(message = "Email inválido")
    String email,
    @NotBlank(message = "La contraseña es obligatoria")
    @JsonAlias("pwd")
    String password
) {
}
