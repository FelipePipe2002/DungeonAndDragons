package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.CharacterEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CharacterRepository extends JpaRepository<CharacterEntity, Long> {

    List<CharacterEntity> findByLandmarkIdOrderByNombreAsc(Long landmarkId);

    boolean existsByImagenAsset_Id(Long imagenAssetId);
}
