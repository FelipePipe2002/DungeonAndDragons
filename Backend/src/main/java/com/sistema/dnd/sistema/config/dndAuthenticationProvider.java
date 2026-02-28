package com.sistema.dnd.sistema.config;

import com.sistema.dnd.sistema.entity.Usuario;
import com.sistema.dnd.sistema.repository.UsuarioRepository;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class dndAuthenticationProvider implements AuthenticationProvider {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;

    public dndAuthenticationProvider(UsuarioRepository usuarioRepository, PasswordEncoder passwordEncoder) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
    }

    private List<GrantedAuthority> getGrantedAuthority() {
        return List.of(new SimpleGrantedAuthority("ROLE_USER"));
    }

    @Override
    public Authentication authenticate(Authentication authentication) throws AuthenticationException {
        String username = authentication.getName();
        if (username != null) {
            username = username.trim().toLowerCase();
        }
        String pwd = authentication.getCredentials().toString();

        Usuario user = usuarioRepository.findByEmail(username);
        if (user == null ||!passwordEncoder.matches(pwd, user.getPwd())) {
            throw new BadCredentialsException("Credenciales incorrectas");
        }

        return new UsernamePasswordAuthenticationToken(user, pwd, getGrantedAuthority());
    }

    @Override
    public boolean supports(Class<?> authentication) {
        return UsernamePasswordAuthenticationToken.class.isAssignableFrom(authentication);
    }
}
