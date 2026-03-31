package com.sistema.dnd.sistema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "buildings")
@Getter
@Setter
public class BuildingEntity extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "landmark_id")
    private LandmarkEntity landmark;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id")
    private OrganizationEntity organization;

    @Column(nullable = false, length = 200)
    private String nombre;

    @Column(name = "posicion_x")
    private Double posicionX;

    @Column(name = "posicion_y")
    private Double posicionY;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String descripcion = "";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dueno_id")
    private CharacterEntity dueno;

    @Column(name = "map_building_index")
    private Integer mapBuildingIndex;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "map_asset_id")
    private MediaAssetEntity mapAsset;

    @Column(name = "map_rotation_degrees", nullable = false)
    private Integer mapRotationDegrees = 0;

    @Column(name = "map_grid_enabled", nullable = false)
    private Boolean mapGridEnabled = false;

    @Column(name = "map_grid_cell_size", nullable = false)
    private Double mapGridCellSize = 48.0;

    @Column(name = "map_grid_offset_x", nullable = false)
    private Double mapGridOffsetX = 0.0;

    @Column(name = "map_grid_offset_y", nullable = false)
    private Double mapGridOffsetY = 0.0;

}
