package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.EstadoLandmarkRoleEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EstadoLandmarkRoleRepository extends JpaRepository<EstadoLandmarkRoleEntity, Long> {

    List<EstadoLandmarkRoleEntity> findByEstado_IdOrderByIdAsc(Long estadoId);

    void deleteByEstado_Id(Long estadoId);
}
