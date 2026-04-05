package com.sistema.dnd.sistema.Filter;

import com.sistema.dnd.sistema.config.ProjectSecurityConfig;
import com.sistema.dnd.sistema.entity.Usuario;
import com.sistema.dnd.sistema.repository.UsuarioRepository;
import io.jsonwebtoken.Jwts;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.util.Collection;
import java.util.Date;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

public class JwtTokenGeneratorFilter extends OncePerRequestFilter {

    private final SecretKey jwtSigningKey;
    private final UsuarioRepository usuarioRepository;

    public JwtTokenGeneratorFilter(UsuarioRepository usuarioRepository, SecretKey jwtSigningKey) {
        this.usuarioRepository = usuarioRepository;
        this.jwtSigningKey = jwtSigningKey;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()) {
            String csrfTokenValue = UUID.randomUUID().toString();

            String email = null;
            Object principal = authentication.getPrincipal();
            if (principal instanceof Usuario usuario) {
                email = usuario.getEmail();
            } else if (principal instanceof String username) {
                email = username;
            }

            if (email != null) {
                Usuario fullUser = usuarioRepository.findByEmail(email.trim().toLowerCase());
                if (fullUser != null) {
                    String jwt = Jwts.builder()
                            .issuer("dnd")
                            .subject("JWT Token")
                            .claim(ProjectSecurityConfig.X_XSRF_TOKEN, csrfTokenValue)
                            .claim("username", fullUser.getEmail())
                            .claim("authorities", populateAuthorities(authentication.getAuthorities()))
                            .issuedAt(new Date())
                            .expiration(new Date((new Date()).getTime() + 20000000))
                            .signWith(jwtSigningKey)
                            .compact();

                    Cookie cookie = new Cookie(ProjectSecurityConfig.JWT_TOKEN, jwt);
                    cookie.setHttpOnly(true);
                    cookie.setSecure(false);
                    cookie.setPath("/");
                    cookie.setMaxAge(20000);
                    response.addCookie(cookie);

                    response.setHeader(ProjectSecurityConfig.X_XSRF_TOKEN, csrfTokenValue);
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"/auth/login".equals(request.getServletPath());
    }

    private String populateAuthorities(Collection<? extends GrantedAuthority> collection) {
        Set<String> authoritiesSet = new HashSet<>();
        for (GrantedAuthority authority : collection) {
            authoritiesSet.add(authority.getAuthority());
        }
        return String.join(",", authoritiesSet);
    }
}
