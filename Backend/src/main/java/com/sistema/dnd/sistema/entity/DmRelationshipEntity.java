package com.sistema.dnd.sistema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "dm_relationships")
@Getter
@Setter
public class DmRelationshipEntity extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

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
