package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.MediaAssetEntity;
import com.sistema.dnd.sistema.entity.enums.MediaAssetKind;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MediaAssetRepository extends JpaRepository<MediaAssetEntity, Long> {

    List<MediaAssetEntity> findAllByKindOrderByFilenameAsc(MediaAssetKind kind);

    Optional<MediaAssetEntity> findByKindAndFilename(MediaAssetKind kind, String filename);

    @Modifying
    @Query("delete from MediaAssetEntity asset where asset.id = :id")
    int deleteByIdIfExists(@Param("id") Long id);
}
