package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.TagEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TagRepository extends JpaRepository<TagEntity, Long> {

    TagEntity findByNombre(String nombre);

    TagEntity findByNombreIgnoreCase(String nombre);
}
