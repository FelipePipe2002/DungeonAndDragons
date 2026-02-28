package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.OrganizationCategoryEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrganizationCategoryRepository extends JpaRepository<OrganizationCategoryEntity, Long> {

    List<OrganizationCategoryEntity> findByOrganizationIdOrderByCategoriaAsc(Long organizationId);

    void deleteByOrganizationId(Long organizationId);
}
