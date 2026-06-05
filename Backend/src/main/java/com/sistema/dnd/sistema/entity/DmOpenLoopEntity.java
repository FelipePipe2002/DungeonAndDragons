package com.sistema.dnd.sistema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "dm_open_loops")
@Getter
@Setter
public class DmOpenLoopEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(name = "loop_type", nullable = false, length = 30)
    private String loopType;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(nullable = false, length = 20)
    private String priority;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String summary;

    @Column(name = "next_step", columnDefinition = "TEXT")
    private String nextStep;

    @Column(columnDefinition = "TEXT")
    private String consequence;

    @Column(columnDefinition = "TEXT")
    private String reward;

    @Column(length = 120)
    private String location;

    @Column(name = "due_at", length = 200)
    private String dueAt;

    @Column(columnDefinition = "TEXT")
    private String notes;
}
