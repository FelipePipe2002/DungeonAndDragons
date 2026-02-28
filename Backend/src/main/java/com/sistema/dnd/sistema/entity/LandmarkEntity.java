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
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "landmarks")
@Getter
@Setter
public class LandmarkEntity extends AuditableEntity {

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

}
