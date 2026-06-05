package com.sistema.dnd.sistema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "dm_relationships")
@Getter
@Setter
public class DmRelationshipEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "left_entity_type", nullable = false, length = 30)
    private String leftEntityType;

    @Column(name = "left_entity_id", nullable = false)
    private Long leftEntityId;

    @Column(name = "right_entity_type", nullable = false, length = 30)
    private String rightEntityType;

    @Column(name = "right_entity_id", nullable = false)
    private Long rightEntityId;

    @Column(nullable = false, length = 20)
    private String direction;

    @Column(nullable = false, length = 120)
    private String label;

    @Column(columnDefinition = "TEXT")
    private String notes;
}
