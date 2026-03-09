package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.MediaAssetEntity;
import com.sistema.dnd.sistema.entity.MediaAssetKind;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MediaAssetRepository extends JpaRepository<MediaAssetEntity, Long> {

    List<MediaAssetEntity> findAllByKindOrderByFilenameAsc(MediaAssetKind kind);

    Optional<MediaAssetEntity> findByKindAndFilename(MediaAssetKind kind, String filename);
}
