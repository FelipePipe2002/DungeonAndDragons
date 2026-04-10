package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.PartyInventoryItemEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PartyInventoryItemRepository extends JpaRepository<PartyInventoryItemEntity, Long> {
    List<PartyInventoryItemEntity> findAllByOrderByUpdatedAtDescIdDesc();
}
