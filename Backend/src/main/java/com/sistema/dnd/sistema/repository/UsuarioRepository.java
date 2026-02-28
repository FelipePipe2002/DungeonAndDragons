package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.Usuario;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface UsuarioRepository extends JpaRepository<Usuario, Long>, JpaSpecificationExecutor<Usuario> {

    Usuario findByEmail(String email);

    @Modifying
    @Query(value = "LOCK TABLE usuarios IN ACCESS EXCLUSIVE MODE", nativeQuery = true)
    void lockUsuariosTable();

}
