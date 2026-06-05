package com.sistema.dnd.sistema.entity;

import com.sistema.dnd.sistema.entity.enums.LandmarkMapKind;
import com.sistema.dnd.sistema.entity.enums.LandmarkMapSource;
import com.sistema.dnd.sistema.entity.enums.LandmarkType;
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
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "landmarks")
@Getter
@Setter
public class LandmarkEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String icono = "";

    @Column(nullable = false, length = 200)
    private String nombre;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LandmarkType tipo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "estado_id")
    private EstadoEntity estado;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subdivision_id")
    private EstadoEntity subdivision;

    @Column(name = "escala_icono", nullable = false)
    private Double escalaIcono;

    @Column(name = "escala_texto", nullable = false)
    private Double escalaTexto;

    @Column(name = "mostrar_leyenda", nullable = false)
    private Boolean mostrarLeyenda;

    @Column(name = "posicion_x", nullable = false)
    private Double posicionX;

    @Column(name = "posicion_y", nullable = false)
    private Double posicionY;

    private Integer poblacion;

    @Column(name = "descripcion_corta")
    private String descripcionCorta;

    @Column(columnDefinition = "TEXT")
    private String historia;

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

    @Column(name = "organization_map_links", columnDefinition = "TEXT")
    private String organizationMapLinks;

    @Column(name = "hidden_map_buildings", columnDefinition = "TEXT")
    private String hiddenMapBuildings;

    @Column(name = "dungeon_generator_config", columnDefinition = "TEXT")
    private String dungeonGeneratorConfig;

    @Enumerated(EnumType.STRING)
    @Column(name = "map_kind", length = 20)
    private LandmarkMapKind mapKind;

    @Enumerated(EnumType.STRING)
    @Column(name = "map_source", length = 20)
    private LandmarkMapSource mapSource;

    @Column(name = "map_filename")
    private String mapFilename;

    @Column(name = "map_url")
    private String mapUrl;

    @Column(name = "map_storage_key")
    private String mapStorageKey;

    @Column(name = "map_data_url", columnDefinition = "TEXT")
    private String mapDataUrl;

}
