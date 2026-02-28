package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.LandmarkEventEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LandmarkEventRepository extends JpaRepository<LandmarkEventEntity, Long> {

    List<LandmarkEventEntity> findByLandmarkIdOrderByIdDesc(Long landmarkId);

    void deleteByLandmarkId(Long landmarkId);
}
