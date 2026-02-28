package com.sistema.dnd.sistema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.Locale;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "tags", uniqueConstraints = {
    @UniqueConstraint(name = "uk_tags_nombre", columnNames = {"nombre"})
})
@Getter
@Setter
public class TagEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String nombre;

    @PrePersist
    @PreUpdate
    void normalizeNombre() {
        if (nombre != null) {
            nombre = nombre.trim().toLowerCase(Locale.ROOT);
        }
    }
}
