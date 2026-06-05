package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.BuildingEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BuildingRepository extends JpaRepository<BuildingEntity, Long> {

    List<BuildingEntity> findByLandmarkIdOrderByNombreAsc(Long landmarkId);

    List<BuildingEntity> findByOrganizationIdOrderByNombreAsc(Long organizationId);

    List<BuildingEntity> findByDuenoIdOrderByNombreAsc(Long duenoId);

    List<BuildingEntity> findByLandmarkIdAndNombreIgnoreCaseOrderByIdAsc(Long landmarkId, String nombre);
}
