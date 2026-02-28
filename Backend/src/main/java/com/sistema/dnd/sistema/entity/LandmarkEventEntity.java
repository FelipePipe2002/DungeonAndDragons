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
import java.time.OffsetDateTime;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "landmark_events")
@Getter
@Setter
public class LandmarkEventEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "landmark_id", nullable = false)
    private LandmarkEntity landmark;

    @Column(nullable = false, length = 200)
    private String nombre;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String descripcion = "";

    @Column(length = 120)
    private String fecha;

    @Column(name = "posicion_x")
    private Double posicionX;

    @Column(name = "posicion_y")
    private Double posicionY;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
