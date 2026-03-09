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
@Table(name = "characters")
@Getter
@Setter
public class CharacterEntity extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "landmark_id")
    private LandmarkEntity landmark;

    @Column(nullable = false, length = 200)
    private String nombre;

    @Column(nullable = false, length = 120)
    private String clase = "";

    @Column(nullable = false, length = 120)
    private String raza = "";

    @Column(nullable = false, columnDefinition = "TEXT")
    private String descripcion = "";

    @Column(name = "is_player", nullable = false)
    private boolean player = false;

    @Column(name = "character_sheet", columnDefinition = "TEXT")
    private String characterSheet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "imagen_asset_id")
    private MediaAssetEntity imagenAsset;

    private String imagen;

    @Column(name = "token_image_focus_x")
    private Double tokenImageFocusX;

    @Column(name = "token_image_focus_y")
    private Double tokenImageFocusY;

    @Column(name = "token_image_zoom")
    private Double tokenImageZoom;

    @Column(name = "initiative_image_focus_x")
    private Double initiativeImageFocusX;

    @Column(name = "initiative_image_focus_y")
    private Double initiativeImageFocusY;

    @Column(name = "initiative_image_zoom")
    private Double initiativeImageZoom;

}
