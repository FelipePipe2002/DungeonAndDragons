package com.sistema.dnd.sistema.services;

import com.sistema.dnd.sistema.dto.domain.MonsterTokenImageResolveDto;
import com.sistema.dnd.sistema.entity.MediaAssetEntity;
import com.sistema.dnd.sistema.entity.enums.MediaAssetKind;
import com.sistema.dnd.sistema.entity.enums.MediaAssetStorageMode;
import com.sistema.dnd.sistema.repository.MediaAssetRepository;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class MonsterTokenImageService {

    private static final String MONSTER_TOKEN_FILENAME_PREFIX = "monster-token";
    private static final String TOKEN_BASE_URL = "https://5e.tools/img/bestiary/tokens";
    private static final long MAX_IMAGE_BYTES = 20L * 1024L * 1024L;
    private static final int MAX_FILENAME_LENGTH = 255;
    private static final int MAX_SOURCE_SEGMENT_LENGTH = 40;
    private static final int MIN_NAME_SEGMENT_LENGTH = 16;
    private static final Set<String> ALLOWED_IMAGE_CONTENT_TYPES = Set.of(
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif",
        "image/avif",
        "image/svg+xml"
    );

    private final MediaAssetRepository mediaAssetRepository;
    private final HttpClient httpClient;

    public MonsterTokenImageService(MediaAssetRepository mediaAssetRepository) {
        this.mediaAssetRepository = mediaAssetRepository;
        this.httpClient = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NORMAL)
            .connectTimeout(Duration.ofSeconds(6))
            .build();
    }

    public MonsterTokenImageResolveDto resolve(String rawMonsterName, List<String> rawSources) {
        String monsterName = normalizeMonsterName(rawMonsterName);
        List<SourceResolutionCandidate> sourceCandidates = normalizeSourceCandidates(rawSources);
        if (sourceCandidates.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "source es obligatorio");
        }

        for (SourceResolutionCandidate sourceCandidate : sourceCandidates) {
            Optional<MediaAssetEntity> existingAsset = findExisting(sourceCandidate.canonicalSource(), monsterName);
            if (existingAsset.isPresent()) {
                return toResponse("cached", existingAsset.get(), sourceCandidate.canonicalSource());
            }
        }

        for (SourceResolutionCandidate sourceCandidate : sourceCandidates) {
            DownloadedImage downloadedImage = downloadMonsterToken(monsterName, sourceCandidate.downloadSources());
            if (downloadedImage == null) {
                continue;
            }

            String filename = buildFilename(sourceCandidate.canonicalSource(), monsterName);
            Optional<MediaAssetEntity> existingAsset = mediaAssetRepository.findByKindAndFilename(MediaAssetKind.image, filename);
            if (existingAsset.isPresent()) {
                return toResponse("cached", existingAsset.get(), sourceCandidate.canonicalSource());
            }

            MediaAssetEntity entity = new MediaAssetEntity();
            entity.setKind(MediaAssetKind.image);
            entity.setFilename(filename);
            entity.setContentType(downloadedImage.contentType());
            entity.setByteSize((long) downloadedImage.bytes().length);
            entity.setChecksumSha256(sha256(downloadedImage.bytes()));
            entity.setStorageMode(MediaAssetStorageMode.db);
            entity.setBinaryContent(downloadedImage.bytes());
            entity.setTextContent(null);

            try {
                MediaAssetEntity saved = mediaAssetRepository.saveAndFlush(entity);
                return toResponse("downloaded", saved, sourceCandidate.canonicalSource());
            } catch (DataIntegrityViolationException ex) {
                Optional<MediaAssetEntity> concurrentAsset = mediaAssetRepository.findByKindAndFilename(
                    MediaAssetKind.image,
                    filename
                );
                if (concurrentAsset.isPresent()) {
                    return toResponse("cached", concurrentAsset.get(), sourceCandidate.canonicalSource());
                }
                throw ex;
            }
        }

        return new MonsterTokenImageResolveDto("missing", null, null, null);
    }

    private Optional<MediaAssetEntity> findExisting(String canonicalSource, String monsterName) {
        String filename = buildFilename(canonicalSource, monsterName);
        return mediaAssetRepository.findByKindAndFilename(MediaAssetKind.image, filename);
    }

    private MonsterTokenImageResolveDto toResponse(String status, MediaAssetEntity asset, String matchedSource) {
        return new MonsterTokenImageResolveDto(
            status,
            asset.getId(),
            "/v1/assets/" + asset.getId(),
            matchedSource
        );
    }

    private String normalizeMonsterName(String rawMonsterName) {
        String normalized = rawMonsterName == null ? "" : rawMonsterName.trim().replaceAll("\\s+", " ");
        if (normalized.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "name es obligatorio");
        }
        return normalized;
    }

    private List<SourceResolutionCandidate> normalizeSourceCandidates(List<String> rawSources) {
        if (rawSources == null || rawSources.isEmpty()) {
            return List.of();
        }

        Map<String, LinkedHashSet<String>> byCanonical = new LinkedHashMap<>();
        for (String value : rawSources) {
            String normalized = normalizeSourceText(value);
            if (normalized.isBlank()) {
                continue;
            }

            String canonical = normalized.toUpperCase(Locale.ROOT);
            LinkedHashSet<String> candidates = byCanonical.computeIfAbsent(canonical, key -> new LinkedHashSet<>());
            candidates.addAll(buildDownloadSourceCandidates(normalized, canonical));
        }

        List<SourceResolutionCandidate> result = new ArrayList<>();
        for (Map.Entry<String, LinkedHashSet<String>> entry : byCanonical.entrySet()) {
            result.add(new SourceResolutionCandidate(entry.getKey(), new ArrayList<>(entry.getValue())));
        }
        return result;
    }

    private List<String> buildDownloadSourceCandidates(String normalizedSource, String canonicalSource) {
        LinkedHashSet<String> candidates = new LinkedHashSet<>();
        candidates.add(normalizedSource);
        candidates.add(canonicalSource);

        if (canonicalSource.startsWith("X") && canonicalSource.length() > 1) {
            String legacyCanonicalSource = canonicalSource.substring(1);
            candidates.add(legacyCanonicalSource);
            candidates.add(legacyCanonicalSource.toLowerCase(Locale.ROOT));
        }

        return new ArrayList<>(candidates);
    }

    private String normalizeSourceText(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    private String buildFilename(String canonicalSource, String monsterName) {
        String sourceSegment = sanitizeFilenameSegment(canonicalSource, MAX_SOURCE_SEGMENT_LENGTH);
        int baseLength =
            MONSTER_TOKEN_FILENAME_PREFIX.length() + 1 + sourceSegment.length() + 1 + ".webp".length();
        int maxNameSegmentLength = Math.max(MIN_NAME_SEGMENT_LENGTH, MAX_FILENAME_LENGTH - baseLength);
        String nameSegment = sanitizeFilenameSegment(monsterName, maxNameSegmentLength);
        return MONSTER_TOKEN_FILENAME_PREFIX + "/" + sourceSegment + "/" + nameSegment + ".webp";
    }

    private String sanitizeFilenameSegment(String value, int maxLength) {
        String normalized = value == null ? "" : value
            .trim()
            .replaceAll("[\\\\/:*?\"<>|]+", "-")
            .replaceAll("\\s+", "_")
            .replaceAll("[. ]+$", "");

        if (normalized.isBlank()) {
            normalized = "unknown";
        }
        if (normalized.length() > maxLength) {
            return normalized.substring(0, maxLength);
        }
        return normalized;
    }

    private DownloadedImage downloadMonsterToken(String monsterName, List<String> sourceCandidates) {
        for (String sourceCandidate : sourceCandidates) {
            DownloadedImage downloadedImage = tryDownload(monsterName, sourceCandidate);
            if (downloadedImage != null) {
                return downloadedImage;
            }
        }
        return null;
    }

    private DownloadedImage tryDownload(String monsterName, String source) {
        if (source == null || source.isBlank()) {
            return null;
        }

        try {
            String encodedSource = encodePathSegment(source);
            String encodedName = encodePathSegment(monsterName);
            URI uri = URI.create(TOKEN_BASE_URL + "/" + encodedSource + "/" + encodedName + ".webp");
            HttpRequest request = HttpRequest.newBuilder(uri)
                .GET()
                .timeout(Duration.ofSeconds(8))
                .header("Accept", "image/*")
                .build();

            HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() != 200) {
                return null;
            }

            byte[] body = response.body();
            if (body == null || body.length == 0 || body.length > MAX_IMAGE_BYTES) {
                return null;
            }

            String normalizedContentType = normalizeImageContentType(response.headers().firstValue("content-type").orElse(null));
            if (normalizedContentType == null) {
                return null;
            }

            return new DownloadedImage(body, normalizedContentType);
        } catch (IllegalArgumentException | IOException ex) {
            return null;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            return null;
        }
    }

    private String normalizeImageContentType(String contentType) {
        String normalized = contentType == null ? "" : contentType.trim().toLowerCase(Locale.ROOT);
        if (normalized.contains(";")) {
            normalized = normalized.substring(0, normalized.indexOf(';')).trim();
        }

        if (normalized.isBlank()) {
            return "image/webp";
        }

        if (ALLOWED_IMAGE_CONTENT_TYPES.contains(normalized)) {
            return normalized;
        }

        return normalized.startsWith("image/") ? normalized : null;
    }

    private String encodePathSegment(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
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

    private record SourceResolutionCandidate(
        String canonicalSource,
        List<String> downloadSources
    ) {
    }

    private record DownloadedImage(
        byte[] bytes,
        String contentType
    ) {
    }
}
