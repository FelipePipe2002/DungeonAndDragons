package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.BuildingMapRefEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BuildingMapRefRepository extends JpaRepository<BuildingMapRefEntity, Long> {

    Optional<BuildingMapRefEntity> findByBuildingId(Long buildingId);

    void deleteByBuildingId(Long buildingId);
}
