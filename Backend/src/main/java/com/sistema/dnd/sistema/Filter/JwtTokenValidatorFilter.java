package com.sistema.dnd.sistema.Filter;

import com.sistema.dnd.sistema.config.ProjectSecurityConfig;
import com.sistema.dnd.sistema.repository.UsuarioRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.util.Arrays;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

public class JwtTokenValidatorFilter extends OncePerRequestFilter {

    private static final Set<String> PUBLIC_URLS = Set.of(
            "/auth/login",
            "/auth/registration-status",
            "/auth/register",
            "/error"
    );

    private final SecretKey jwtSigningKey;
    private final UsuarioRepository usuarioRepository;

    public JwtTokenValidatorFilter(UsuarioRepository usuarioRepository, SecretKey jwtSigningKey) {
        this.usuarioRepository = usuarioRepository;
        this.jwtSigningKey = jwtSigningKey;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            filterChain.doFilter(request, response);
            return;
        }

        Optional<Cookie> cookieOptional = Arrays.stream(cookies)
                .filter(cookie -> ProjectSecurityConfig.JWT_TOKEN.equals(cookie.getName()))
                .findAny();

        String jwt = cookieOptional.map(Cookie::getValue).orElse(null);
        if (jwt != null) {
            try {
                Claims claims = Jwts.parser()
                        .verifyWith(jwtSigningKey)
                        .build()
                        .parseSignedClaims(jwt)
                        .getPayload();

                if (requiresCsrfValidation(request)) {
                    String csrfTokenValueInPayload = String.valueOf(claims.get(ProjectSecurityConfig.X_XSRF_TOKEN));
                    String csrfTokenHeader = request.getHeader(ProjectSecurityConfig.X_XSRF_TOKEN);
                    if (!Objects.equals(csrfTokenHeader, csrfTokenValueInPayload)) {
                        throw new BadCredentialsException("Invalid Token received");
                    }
                }

                String username = String.valueOf(claims.get("username"));
                String authorities = String.valueOf(claims.get("authorities"));

                if (username != null && !"null".equals(username)) {
                    var user = usuarioRepository.findByEmail(username.trim().toLowerCase());
                    if (user == null) {
                        throw new BadCredentialsException("Usuario no encontrado");
                    }
                }

                Authentication auth = new UsernamePasswordAuthenticationToken(
                        username,
                        null,
                        AuthorityUtils.commaSeparatedStringToAuthorityList(authorities)
                );
                SecurityContextHolder.getContext().setAuthentication(auth);
            } catch (Exception ex) {
                throw new BadCredentialsException("Invalid Token received");
            }
        }

        filterChain.doFilter(request, response);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        return path != null && PUBLIC_URLS.contains(path);
    }

    private boolean requiresCsrfValidation(HttpServletRequest request) {
        String method = request.getMethod();
        if (method == null) return true;

        return !Set.of("GET", "HEAD", "OPTIONS").contains(method.toUpperCase());
    }
}
