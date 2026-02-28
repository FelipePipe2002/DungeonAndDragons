package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.OrganizationEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationRepository extends JpaRepository<OrganizationEntity, Long> {

    boolean existsByImagenAsset_Id(Long imagenAssetId);
}
