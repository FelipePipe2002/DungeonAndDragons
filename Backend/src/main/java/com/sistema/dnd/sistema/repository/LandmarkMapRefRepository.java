package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.LandmarkMapRefEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LandmarkMapRefRepository extends JpaRepository<LandmarkMapRefEntity, Long> {

    Optional<LandmarkMapRefEntity> findByLandmarkId(Long landmarkId);

    void deleteByLandmarkId(Long landmarkId);
}
