package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.CharacterBuildingEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CharacterBuildingRepository extends JpaRepository<CharacterBuildingEntity, Long> {

    List<CharacterBuildingEntity> findByCharacterId(Long characterId);

    void deleteByCharacterId(Long characterId);

    void deleteByBuildingId(Long buildingId);
}
