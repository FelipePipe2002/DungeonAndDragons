package com.sistema.dnd.sistema.services;

import com.sistema.dnd.sistema.config.ProjectSecurityConfig;
import com.sistema.dnd.sistema.dto.RegisterRequest;
import com.sistema.dnd.sistema.entity.Usuario;
import com.sistema.dnd.sistema.repository.UsuarioRepository;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.AllArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@AllArgsConstructor
@Service
public class AuthService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;

    public ResponseEntity<Usuario> login(Authentication authentication) {
        Usuario user = resolveAuthenticatedUser(authentication);
        if (user == null) {
            return new ResponseEntity<>(null, HttpStatus.UNAUTHORIZED);
        }
        return ResponseEntity.ok(user);
    }

    public ResponseEntity<Map<String, Boolean>> registrationStatus() {
        boolean hasRegisteredUser = usuarioRepository.count() > 0;
        return ResponseEntity.ok(Map.of("hasRegisteredUser", hasRegisteredUser));
    }

    @Transactional
    public ResponseEntity<Map<String, String>> logout(HttpServletRequest request, HttpServletResponse response, Authentication authentication) {
        try {
            Cookie jwtCookie = new Cookie(ProjectSecurityConfig.JWT_TOKEN, null);
            jwtCookie.setHttpOnly(true);
            jwtCookie.setSecure(false);
            jwtCookie.setPath("/");
            jwtCookie.setMaxAge(0);
            response.addCookie(jwtCookie);

            return ResponseEntity.ok(Map.of("message", "Logout exitoso"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message", "Error al cerrar sesión"));
        }
    }

    @Transactional
    public ResponseEntity<Map<String, String>> register(RegisterRequest request) {
        String normalizedEmail = normalize(request.email());
        String password = request.password() == null ? null : request.password().trim();

        if (normalizedEmail == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email inválido"));
        }
        if (password == null || password.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "La contraseña es obligatoria"));
        }

        usuarioRepository.lockUsuariosTable();

        if (usuarioRepository.count() > 0) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("message", "Ya existe un usuario registrado. No se permiten más cuentas."));
        }

        if (usuarioRepository.findByEmail(normalizedEmail) != null) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("message", "El email ya está registrado."));
        }

        try {
            Usuario user = new Usuario();
            user.setEmail(normalizedEmail);
            user.setPwd(passwordEncoder.encode(password));
            usuarioRepository.save(user);
        } catch (DataIntegrityViolationException ex) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(Map.of("message", "No se pudo registrar el usuario. Verifica que no exista uno previo."));
        }

        return ResponseEntity.status(HttpStatus.CREATED)
            .header(HttpHeaders.LOCATION, "/api/auth/login")
            .body(Map.of("message", "Usuario creado correctamente", "email", normalizedEmail));
    }

    private Usuario resolveAuthenticatedUser(Authentication authentication) {
        if (authentication == null || authentication.getPrincipal() == null) {
            return null;
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof Usuario usuario) {
            return usuarioRepository.findByEmail(normalize(usuario.getEmail()));
        }

        if (principal instanceof String username && !username.isBlank()) {
            String normalizedUsername = normalize(username);
            return usuarioRepository.findByEmail(normalizedUsername);
        }

        return null;
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim().toLowerCase();
        return normalized.isBlank() ? null : normalized;
    }

}
