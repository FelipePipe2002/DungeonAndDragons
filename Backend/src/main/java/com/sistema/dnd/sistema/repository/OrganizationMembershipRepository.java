package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.OrganizationMembershipEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationMembershipRepository extends JpaRepository<OrganizationMembershipEntity, Long> {

    List<OrganizationMembershipEntity> findByOrganizationId(Long organizationId);

    List<OrganizationMembershipEntity> findByCharacterId(Long characterId);

    List<OrganizationMembershipEntity> findByCharacterLandmarkId(Long landmarkId);

    void deleteByOrganizationId(Long organizationId);

    void deleteByCharacterId(Long characterId);
}
