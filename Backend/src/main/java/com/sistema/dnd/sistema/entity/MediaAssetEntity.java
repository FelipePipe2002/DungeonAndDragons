package com.sistema.dnd.sistema.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "media_assets")
@Getter
@Setter
public class MediaAssetEntity extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MediaAssetKind kind;

    @Column(nullable = false, length = 255)
    private String filename;

    @Column(name = "content_type", nullable = false, length = 120)
    private String contentType;

    @Column(name = "byte_size", nullable = false)
    private Long byteSize;

    @Column(name = "checksum_sha256", length = 64)
    private String checksumSha256;

    @Enumerated(EnumType.STRING)
    @Column(name = "storage_mode", nullable = false, length = 20)
    private MediaAssetStorageMode storageMode = MediaAssetStorageMode.db;

    @Column(name = "text_content", columnDefinition = "TEXT")
    private String textContent;

    @Column(name = "binary_content", columnDefinition = "BYTEA")
    private byte[] binaryContent;
}
