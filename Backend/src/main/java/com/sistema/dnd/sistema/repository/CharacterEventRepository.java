package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.CharacterEventEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CharacterEventRepository extends JpaRepository<CharacterEventEntity, Long> {

    List<CharacterEventEntity> findByCharacterIdOrderByIdDesc(Long characterId);

    void deleteByCharacterId(Long characterId);
}
