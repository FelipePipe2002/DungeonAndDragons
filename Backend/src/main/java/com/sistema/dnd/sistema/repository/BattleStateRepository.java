package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.BattleStateEntity;
import com.sistema.dnd.sistema.entity.BattleSceneType;
import com.sistema.dnd.sistema.entity.BattleStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BattleStateRepository extends JpaRepository<BattleStateEntity, Long> {
    Optional<BattleStateEntity> findFirstByStatusOrderByUpdatedAtDesc(BattleStatus status);
    Optional<BattleStateEntity> findFirstBySceneTypeAndSceneSlugAndStatusOrderByUpdatedAtDesc(
        BattleSceneType sceneType,
        String sceneSlug,
        BattleStatus status
    );
    List<BattleStateEntity> findByParentLandmarkSlugOrderByUpdatedAtDesc(String parentLandmarkSlug);
    List<BattleStateEntity> findByParentLandmarkSlugAndSceneTypeAndSceneSlugOrderByUpdatedAtDesc(
        String parentLandmarkSlug,
        BattleSceneType sceneType,
        String sceneSlug
    );
}
