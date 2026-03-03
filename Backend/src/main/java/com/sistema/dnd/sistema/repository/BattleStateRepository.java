package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.BattleStateEntity;
import com.sistema.dnd.sistema.entity.BattleStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BattleStateRepository extends JpaRepository<BattleStateEntity, Long> {
    Optional<BattleStateEntity> findBySlug(String slug);
    Optional<BattleStateEntity> findFirstByLandmarkSlugAndStatusOrderByUpdatedAtDesc(String landmarkSlug, BattleStatus status);
    List<BattleStateEntity> findByLandmarkSlugOrderByUpdatedAtDesc(String landmarkSlug);
}
