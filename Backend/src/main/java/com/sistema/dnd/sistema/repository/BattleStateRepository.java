package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.BattleStateEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BattleStateRepository extends JpaRepository<BattleStateEntity, Long> {
    Optional<BattleStateEntity> findBySlug(String slug);
}
