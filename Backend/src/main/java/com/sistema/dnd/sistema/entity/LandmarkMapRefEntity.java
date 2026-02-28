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
@Table(name = "landmark_map_refs", uniqueConstraints = {
    @UniqueConstraint(name = "uk_landmark_map_refs_landmark", columnNames = {"landmark_id"})
})
@Getter
@Setter
public class LandmarkMapRefEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "landmark_id", nullable = false)
    private LandmarkEntity landmark;

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
