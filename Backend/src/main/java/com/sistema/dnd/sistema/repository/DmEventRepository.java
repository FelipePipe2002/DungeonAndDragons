package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.DmEventEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DmEventRepository extends JpaRepository<DmEventEntity, Long> {
    List<DmEventEntity> findAllByOrderByCreatedAtDescIdDesc();
}
