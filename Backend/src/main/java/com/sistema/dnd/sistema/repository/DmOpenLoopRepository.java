package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.DmOpenLoopEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DmOpenLoopRepository extends JpaRepository<DmOpenLoopEntity, Long> {
    List<DmOpenLoopEntity> findAllByOrderByUpdatedAtDescIdDesc();
}
