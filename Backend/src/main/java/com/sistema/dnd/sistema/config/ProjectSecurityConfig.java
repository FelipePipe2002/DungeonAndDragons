package com.sistema.dnd.sistema.config;

import com.sistema.dnd.sistema.Filter.EndpointLoggingFilter;
import com.sistema.dnd.sistema.Filter.JwtTokenGeneratorFilter;
import com.sistema.dnd.sistema.Filter.JwtTokenValidatorFilter;
import com.sistema.dnd.sistema.repository.UsuarioRepository;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

@Configuration
public class ProjectSecurityConfig {

    public static final String JWT_HEADER = "Authorization";
    public static final String JWT_TOKEN = "JWT-TOKEN";
    public static final String X_XSRF_TOKEN = "X-XSRF-TOKEN";

    @Autowired
    private UsuarioRepository usuarioRepository;

    @Bean
    public AuthenticationEntryPoint authenticationEntryPoint() {
        return new AuthenticationEntryPoint() {
            @Override
            public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException authException)
                    throws IOException, ServletException {
                response.resetBuffer();
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                response.setHeader("Content-Type", "application/json");
                response.getOutputStream().print(authException.getMessage());
            }
        };
    }

    @Bean
    public EndpointLoggingFilter endpointLoggingFilter() {
        return new EndpointLoggingFilter();
    }

    @Bean
    SecurityFilterChain defaultSecurityFilterChain(HttpSecurity http, SecretKey jwtSigningKey) throws Exception {
        http.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .csrf(AbstractHttpConfigurer::disable)
                .cors(corsCustomizer -> corsCustomizer.configurationSource(corsConfigurationSource()));

        http.httpBasic(basicConfigurer -> basicConfigurer.authenticationEntryPoint(authenticationEntryPoint()))
                .addFilterAfter(new JwtTokenGeneratorFilter(usuarioRepository, jwtSigningKey), BasicAuthenticationFilter.class)
                .addFilterBefore(new JwtTokenValidatorFilter(usuarioRepository, jwtSigningKey), BasicAuthenticationFilter.class)
                .addFilterBefore(endpointLoggingFilter(), JwtTokenValidatorFilter.class);

        http.authorizeHttpRequests(requests -> requests
                .requestMatchers(HttpMethod.GET, "/auth/login").authenticated()
                .requestMatchers(HttpMethod.GET, "/auth/registration-status").permitAll()
                .requestMatchers(HttpMethod.POST, "/auth/register").permitAll()
                .requestMatchers("/error").permitAll()
                .requestMatchers("/v1/**").authenticated()
                .requestMatchers(
                        "/auth/logout",
                        "/user/**"
                ).authenticated()
                .anyRequest().denyAll());

        return http.build();
    }

    @Bean
    SecretKey jwtSigningKey(@Value("${security.jwt.secret:${JWT_SECRET_KEY:}}") String jwtSecret) {
        if (jwtSecret == null || jwtSecret.isBlank()) {
            throw new IllegalStateException("JWT secret no configurado. Defini security.jwt.secret o JWT_SECRET_KEY.");
        }
        return Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        return request -> {
            CorsConfiguration config = new CorsConfiguration();
            config.setAllowedOrigins(Collections.singletonList("http://localhost:3000"));
            config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
            config.setAllowCredentials(true);
            config.setAllowedHeaders(Collections.singletonList("*"));
            config.setExposedHeaders(List.of(
                    JWT_HEADER,
                    X_XSRF_TOKEN
            ));
            config.setMaxAge(3600L);
            return config;
        };
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
