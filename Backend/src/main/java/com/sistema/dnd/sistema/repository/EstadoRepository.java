package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.EstadoEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EstadoRepository extends JpaRepository<EstadoEntity, Long> {

    List<EstadoEntity> findByEstadoPadreIsNullOrderByNombreAsc();

    List<EstadoEntity> findByEstadoPadre_IdOrderByNombreAsc(Long estadoPadreId);
}
