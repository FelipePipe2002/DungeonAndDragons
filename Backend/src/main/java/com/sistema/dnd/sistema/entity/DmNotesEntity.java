package com.sistema.dnd.sistema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "dm_notes")
@Getter
@Setter
public class DmNotesEntity extends AuditableEntity {

    @Id
    private Long id;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String texto = "";
}
