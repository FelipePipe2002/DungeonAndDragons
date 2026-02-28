package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.LandmarkEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LandmarkRepository extends JpaRepository<LandmarkEntity, Long> {

    boolean existsByMapAsset_Id(Long mapAssetId);
}
