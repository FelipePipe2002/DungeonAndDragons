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
@Table(name = "estados")
@Getter
@Setter
public class EstadoEntity extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String nombre;

    @Column(nullable = false, length = 120)
    private String tipo = "";

    @Column(nullable = false, columnDefinition = "TEXT")
    private String descripcion = "";

    @Column(nullable = false, columnDefinition = "TEXT")
    private String historia = "";

    @Column(name = "gobierno_tipo", nullable = false, length = 120)
    private String gobiernoTipo = "";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "imagen_asset_id")
    private MediaAssetEntity imagenAsset;

    private String imagen;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "territorio_imagen_asset_id")
    private MediaAssetEntity territorioImagenAsset;

    @Column(name = "territorio_imagen", columnDefinition = "TEXT")
    private String territorioImagen;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "estado_padre_id")
    private EstadoEntity estadoPadre;
}
