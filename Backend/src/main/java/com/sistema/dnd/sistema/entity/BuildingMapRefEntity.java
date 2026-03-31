package com.sistema.dnd.sistema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "building_map_refs", uniqueConstraints = {
    @UniqueConstraint(name = "uk_building_map_refs_building", columnNames = {"building_id"})
})
@Getter
@Setter
public class BuildingMapRefEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "building_id", nullable = false)
    private BuildingEntity building;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LandmarkMapKind kind;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private LandmarkMapSource source;

    private String filename;

    private String url;

    @Column(name = "storage_key")
    private String storageKey;

    @Column(name = "data_url", columnDefinition = "TEXT")
    private String dataUrl;
}
