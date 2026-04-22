package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.SubdivisionEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SubdivisionRepository extends JpaRepository<SubdivisionEntity, Long> {

    List<SubdivisionEntity> findByEstado_IdOrderByNombreAsc(Long estadoId);
}
