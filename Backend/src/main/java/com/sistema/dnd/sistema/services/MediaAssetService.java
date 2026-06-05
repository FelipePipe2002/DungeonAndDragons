package com.sistema.dnd.sistema.services;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sistema.dnd.sistema.dto.domain.MediaAssetMetadataDto;
import com.sistema.dnd.sistema.entity.MediaAssetEntity;
import com.sistema.dnd.sistema.entity.enums.MediaAssetKind;
import com.sistema.dnd.sistema.entity.enums.MediaAssetStorageMode;
import com.sistema.dnd.sistema.repository.CharacterRepository;
import com.sistema.dnd.sistema.repository.LandmarkRepository;
import com.sistema.dnd.sistema.repository.MediaAssetRepository;
import com.sistema.dnd.sistema.repository.OrganizationRepository;
import jakarta.transaction.Transactional;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MediaAssetService {

    private static final long MAX_UPLOAD_BYTES = 20L * 1024L * 1024L;
    private static final Set<String> ALLOWED_IMAGE_CONTENT_TYPES = Set.of(
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif",
        "image/avif",
        "image/svg+xml"
    );

    private final MediaAssetRepository mediaAssetRepository;
    private final CharacterRepository characterRepository;
    private final OrganizationRepository organizationRepository;
    private final LandmarkRepository landmarkRepository;
    private final ObjectMapper objectMapper;

    public MediaAssetService(
        MediaAssetRepository mediaAssetRepository,
        CharacterRepository characterRepository,
        OrganizationRepository organizationRepository,
        LandmarkRepository landmarkRepository,
        ObjectMapper objectMapper
    ) {
        this.mediaAssetRepository = mediaAssetRepository;
        this.characterRepository = characterRepository;
        this.organizationRepository = organizationRepository;
        this.landmarkRepository = landmarkRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public MediaAssetMetadataDto create(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El archivo es obligatorio");
        }

        byte[] bytes = readBytes(file);
        if (bytes.length == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El archivo esta vacio");
        }
        if (bytes.length > MAX_UPLOAD_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El archivo supera el tamano maximo permitido");
        }

        String filename = normalizeFilename(file.getOriginalFilename());
        String contentType = normalizeContentType(file.getContentType(), filename);
        MediaAssetKind kind = detectKind(contentType, filename);
        if (kind == MediaAssetKind.json) {
            contentType = "application/json";
        }

        MediaAssetEntity entity = new MediaAssetEntity();
        entity.setKind(kind);
        entity.setFilename(filename);
        entity.setContentType(contentType);
        entity.setByteSize((long) bytes.length);
        entity.setChecksumSha256(sha256(bytes));
        entity.setStorageMode(MediaAssetStorageMode.db);

        if (kind == MediaAssetKind.json) {
            String text = new String(bytes, StandardCharsets.UTF_8);
            validateJson(text);
            entity.setTextContent(text);
            entity.setBinaryContent(null);
        } else {
            entity.setBinaryContent(bytes);
            entity.setTextContent(null);
        }

        MediaAssetEntity saved = mediaAssetRepository.save(entity);
        return toMetadataDto(saved);
    }

    public MediaAssetMetadataDto findMetadata(Long id) {
        return toMetadataDto(findEntity(id));
    }

    public AssetDownload findDownload(Long id) {
        MediaAssetEntity entity = findEntity(id);
        byte[] body = entity.getKind() == MediaAssetKind.json
            ? entity.getTextContent().getBytes(StandardCharsets.UTF_8)
            : entity.getBinaryContent();

        return new AssetDownload(
            entity.getFilename(),
            entity.getContentType(),
            body
        );
    }

    @Transactional
    public void delete(Long id) {
        if (isReferenced(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "El asset esta en uso y no puede borrarse");
        }
        mediaAssetRepository.deleteByIdIfExists(id);
    }

    public MediaAssetEntity findRequired(Long id) {
        return findEntity(id);
    }

    private MediaAssetEntity findEntity(Long id) {
        return mediaAssetRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Asset no encontrado"));
    }

    private boolean isReferenced(Long assetId) {
        return characterRepository.existsByImagenAsset_Id(assetId)
            || organizationRepository.existsByImagenAsset_Id(assetId)
            || landmarkRepository.existsByMapAsset_Id(assetId);
    }

    private byte[] readBytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No se pudo leer el archivo");
        }
    }

    private String normalizeFilename(String originalFilename) {
        if (originalFilename == null) {
            return "asset";
        }

        String normalized = originalFilename
            .replace('\\', '/')
            .trim();
        int lastSeparator = normalized.lastIndexOf('/');
        String filename = lastSeparator >= 0 ? normalized.substring(lastSeparator + 1) : normalized;
        if (filename.isBlank()) {
            return "asset";
        }
        return filename;
    }

    private String normalizeContentType(String contentType, String filename) {
        String normalized = contentType == null ? "" : contentType.trim().toLowerCase(Locale.ROOT);
        if (!normalized.isEmpty()) {
            return normalized;
        }

        if (filename.toLowerCase(Locale.ROOT).endsWith(".json")) {
            return "application/json";
        }

        return "application/octet-stream";
    }

    private MediaAssetKind detectKind(String contentType, String filename) {
        if (ALLOWED_IMAGE_CONTENT_TYPES.contains(contentType)) {
            return MediaAssetKind.image;
        }

        boolean looksLikeJson = "application/json".equals(contentType)
            || "text/plain".equals(contentType)
            || filename.toLowerCase(Locale.ROOT).endsWith(".json");
        if (looksLikeJson) {
            return MediaAssetKind.json;
        }

        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tipo de archivo no soportado");
    }

    private void validateJson(String value) {
        try {
            objectMapper.readTree(value);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El archivo JSON es invalido");
        }
    }

    private String sha256(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(bytes);
            StringBuilder builder = new StringBuilder(hash.length * 2);
            for (byte item : hash) {
                builder.append(String.format("%02x", item & 0xff));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 no disponible", ex);
        }
    }

    private MediaAssetMetadataDto toMetadataDto(MediaAssetEntity entity) {
        return new MediaAssetMetadataDto(
            entity.getId(),
            entity.getKind().name(),
            entity.getFilename(),
            entity.getContentType(),
            entity.getByteSize(),
            "/v1/assets/" + entity.getId(),
            entity.getCreatedAt(),
            entity.getUpdatedAt()
        );
    }

    public record AssetDownload(
        String filename,
        String contentType,
        byte[] body
    ) {
    }
}
