package com.sistema.dnd.sistema.repository;

import com.sistema.dnd.sistema.entity.enums.TaggableEntityType;
import com.sistema.dnd.sistema.entity.TaggingEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TaggingRepository extends JpaRepository<TaggingEntity, Long> {

    void deleteByEntityTypeAndEntityId(TaggableEntityType entityType, Long entityId);

    @Query("""
        select tg.tag.nombre
        from TaggingEntity tg
        where tg.entityType = :entityType and tg.entityId = :entityId
        order by tg.tag.nombre asc
    """)
    List<String> findTagNamesByEntity(
        @Param("entityType") TaggableEntityType entityType,
        @Param("entityId") Long entityId
    );
}
