package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.BattleStateEntity;
import com.sistema.dnd.sistema.entity.BattleSceneType;
import com.sistema.dnd.sistema.entity.BattleStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface BattleStateRepository extends JpaRepository<BattleStateEntity, Long> {
    Optional<BattleStateEntity> findFirstByStatusOrderByUpdatedAtDesc(BattleStatus status);
    List<BattleStateEntity> findByStatusOrderByUpdatedAtDesc(BattleStatus status);
    Optional<BattleStateEntity> findFirstBySceneTypeAndSceneSlugAndStatusOrderByUpdatedAtDesc(
        BattleSceneType sceneType,
        String sceneSlug,
        BattleStatus status
    );
    List<BattleStateEntity> findBySceneTypeAndStatusOrderByUpdatedAtDesc(BattleSceneType sceneType, BattleStatus status);
    Page<BattleStateEntity> findByStatus(BattleStatus status, Pageable pageable);
    Page<BattleStateEntity> findBySceneTypeAndStatus(BattleSceneType sceneType, BattleStatus status, Pageable pageable);
    List<BattleStateEntity> findByParentLandmarkSlugOrderByUpdatedAtDesc(String parentLandmarkSlug);
    List<BattleStateEntity> findByParentLandmarkSlugAndSceneTypeAndSceneSlugOrderByUpdatedAtDesc(
        String parentLandmarkSlug,
        BattleSceneType sceneType,
        String sceneSlug
    );
}
