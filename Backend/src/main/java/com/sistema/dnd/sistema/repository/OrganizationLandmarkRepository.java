package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.OrganizationLandmarkEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationLandmarkRepository extends JpaRepository<OrganizationLandmarkEntity, Long> {
    List<OrganizationLandmarkEntity> findByOrganizationId(Long organizationId);
    void deleteByOrganizationId(Long organizationId);
}
