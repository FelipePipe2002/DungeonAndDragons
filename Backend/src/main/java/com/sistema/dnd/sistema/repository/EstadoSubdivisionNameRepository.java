package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.EstadoSubdivisionNameEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EstadoSubdivisionNameRepository extends JpaRepository<EstadoSubdivisionNameEntity, Long> {

    List<EstadoSubdivisionNameEntity> findByEstado_IdOrderByIdAsc(Long estadoId);

    void deleteByEstado_Id(Long estadoId);
}
