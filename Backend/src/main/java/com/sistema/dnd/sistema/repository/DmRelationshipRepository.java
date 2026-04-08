package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.DmRelationshipEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DmRelationshipRepository extends JpaRepository<DmRelationshipEntity, Long> {
    List<DmRelationshipEntity> findAllByOrderByUpdatedAtDescIdDesc();
}
