package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.SavedPageEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SavedPageRepository extends JpaRepository<SavedPageEntity, Long> {
    List<SavedPageEntity> findAllByOrderByTituloAsc();
}
