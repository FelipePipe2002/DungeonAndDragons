package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.EventEntity;
import com.sistema.dnd.sistema.entity.enums.EventOwnerType;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EventRepository extends JpaRepository<EventEntity, Long> {

    List<EventEntity> findByOwnerTypeAndOwnerIdOrderByIdDesc(EventOwnerType ownerType, Long ownerId);

    List<EventEntity> findByOwnerTypeOrderByIdDesc(EventOwnerType ownerType);

    void deleteByOwnerTypeAndOwnerId(EventOwnerType ownerType, Long ownerId);
}
