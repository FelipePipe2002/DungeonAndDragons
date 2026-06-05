package com.sistema.dnd.sistema.entity;

import com.sistema.dnd.sistema.entity.enums.TaggableEntityType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "taggings", uniqueConstraints = {
    @UniqueConstraint(name = "uk_taggings_unique", columnNames = {"tag_id", "entity_type", "entity_id"})
})
@Getter
@Setter
public class TaggingEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tag_id", nullable = false)
    private TagEntity tag;

    @Enumerated(EnumType.STRING)
    @Column(name = "entity_type", nullable = false, length = 30)
    private TaggableEntityType entityType;

    @Column(name = "entity_id", nullable = false)
    private Long entityId;
}
