package com.sistema.dnd.sistema.controllers;

import com.sistema.dnd.sistema.dto.RegisterRequest;
import com.sistema.dnd.sistema.entity.Usuario;
import com.sistema.dnd.sistema.services.AuthService;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @GetMapping("/login")
    public ResponseEntity<Usuario> getUserDetailsAfterLogin(Authentication authentication) {
        return authService.login(authentication);
    }

    @GetMapping("/registration-status")
    public ResponseEntity<Map<String, Boolean>> registrationStatus() {
        return authService.registrationStatus();
    }

    @PostMapping("/register")
    public ResponseEntity<Map<String, String>> register(@Valid @RequestBody RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(HttpServletRequest request, HttpServletResponse response, Authentication authentication) {
        return authService.logout(request, response, authentication);
    }
}
