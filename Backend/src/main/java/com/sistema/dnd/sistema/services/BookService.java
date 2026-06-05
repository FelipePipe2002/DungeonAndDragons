package com.sistema.dnd.sistema.services;

import com.sistema.dnd.sistema.dto.domain.BookDto;
import com.sistema.dnd.sistema.dto.domain.BookUploadSessionDto;
import com.sistema.dnd.sistema.entity.MediaAssetEntity;
import com.sistema.dnd.sistema.entity.enums.MediaAssetKind;
import com.sistema.dnd.sistema.entity.enums.MediaAssetStorageMode;
import com.sistema.dnd.sistema.repository.MediaAssetRepository;
import jakarta.transaction.Transactional;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.StandardOpenOption;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.DigestInputStream;
import java.security.NoSuchAlgorithmException;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class BookService {

    private static final long MAX_UPLOAD_BYTES = 500L * 1024L * 1024L;
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(".pdf", ".epub", ".txt", ".md");
    private static final Duration UPLOAD_SESSION_TTL = Duration.ofHours(6);

    private final MediaAssetRepository mediaAssetRepository;
    private final Path booksStorageRoot;
    private final ConcurrentHashMap<String, UploadSessionSnapshot> uploadSessions = new ConcurrentHashMap<>();

    public BookService(
        MediaAssetRepository mediaAssetRepository,
        @Value("${app.storage.books-dir:storage/books}") String booksStorageDir
    ) {
        this.mediaAssetRepository = mediaAssetRepository;
        this.booksStorageRoot = Paths.get(booksStorageDir).toAbsolutePath().normalize();
    }

    public List<BookDto> findAll() {
        return mediaAssetRepository.findAllByKindOrderByFilenameAsc(MediaAssetKind.book)
            .stream()
            .map(this::toDto)
            .toList();
    }

    public BookUploadSessionDto createUploadSession() {
        cleanupExpiredUploadSessions();

        String sessionId = UUID.randomUUID().toString();
        UploadSessionSnapshot snapshot = new UploadSessionSnapshot(
            sessionId,
            "awaiting_upload",
            0,
            0L,
            null,
            null,
            null,
            null,
            nowUtc()
        );
        uploadSessions.put(sessionId, snapshot);
        return toUploadSessionDto(snapshot);
    }

    public BookUploadSessionDto getUploadSession(String sessionId) {
        cleanupExpiredUploadSessions();
        return toUploadSessionDto(requireUploadSession(sessionId));
    }

    // Used by GlobalExceptionHandler when multipart upload is rejected early.
    public void markUploadSessionFailed(String sessionId, String errorMessage) {
        markUploadFailed(sessionId, errorMessage);
    }

    @Transactional
    public BookDto create(MultipartFile file, String uploadSessionId) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El archivo es obligatorio");
        }

        long declaredSize = file.getSize();
        if (declaredSize <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El archivo esta vacio");
        }
        if (declaredSize > MAX_UPLOAD_BYTES) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El archivo supera el tamano maximo permitido de 500 MB");
        }

        String filename = normalizeFilename(file.getOriginalFilename());
        String extension = extensionOf(filename);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Solo se permiten archivos PDF, EPUB, TXT o MD"
            );
        }

        ensureStorageRootExists();
        String storedFilename = buildStoredFilename(extension);
        Path targetPath = booksStorageRoot.resolve(storedFilename).normalize();
        markUploadProcessing(uploadSessionId, declaredSize, filename);

        try {
            StoredFile storedFile = storeFile(file, targetPath, storedFilename, declaredSize, uploadSessionId);

            MediaAssetEntity entity = new MediaAssetEntity();
            entity.setKind(MediaAssetKind.book);
            entity.setFilename(filename);
            entity.setContentType(resolveContentType(file.getContentType(), extension));
            entity.setByteSize(storedFile.byteSize());
            entity.setChecksumSha256(storedFile.checksumSha256());
            entity.setStorageMode(MediaAssetStorageMode.file_system);
            entity.setStoragePath(storedFile.storagePath());
            entity.setBinaryContent(null);
            entity.setTextContent(null);

            try {
                MediaAssetEntity saved = mediaAssetRepository.save(entity);
                markUploadCompleted(uploadSessionId, saved.getId(), saved.getFilename(), storedFile.byteSize());
                return toDto(saved);
            } catch (RuntimeException ex) {
                deleteStoredFileIfExists(targetPath);
                markUploadFailed(uploadSessionId, extractFailureMessage(ex));
                throw ex;
            }
        } catch (RuntimeException ex) {
            deleteStoredFileIfExists(targetPath);
            markUploadFailed(uploadSessionId, extractFailureMessage(ex));
            throw ex;
        }
    }

    public BookDownload findDownload(Long id) {
        MediaAssetEntity entity = findRequired(id);

        if (entity.getStorageMode() == MediaAssetStorageMode.file_system) {
            Path filePath = resolveStoredPath(entity);
            if (!Files.isRegularFile(filePath)) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Archivo del libro no encontrado en almacenamiento");
            }

            return new BookDownload(
                entity.getFilename(),
                entity.getContentType(),
                entity.getByteSize(),
                new FileSystemResource(filePath)
            );
        }

        byte[] bytes = entity.getBinaryContent();
        if (bytes == null || bytes.length == 0) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Contenido del libro no disponible");
        }

        return new BookDownload(
            entity.getFilename(),
            entity.getContentType(),
            entity.getByteSize(),
            new ByteArrayResource(bytes)
        );
    }

    @Transactional
    public void delete(Long id) {
        MediaAssetEntity entity = findRequired(id);
        Path filePath = entity.getStorageMode() == MediaAssetStorageMode.file_system ? resolveStoredPath(entity) : null;

        mediaAssetRepository.delete(entity);
        mediaAssetRepository.flush();

        if (filePath != null) {
            deleteStoredFileIfExists(filePath);
        }
    }

    private MediaAssetEntity findRequired(Long id) {
        MediaAssetEntity entity = mediaAssetRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Libro no encontrado"));

        if (entity.getKind() != MediaAssetKind.book) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Libro no encontrado");
        }

        return entity;
    }

    private void ensureStorageRootExists() {
        try {
            Files.createDirectories(booksStorageRoot);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "No se pudo preparar el almacenamiento de libros");
        }
    }

    private String buildStoredFilename(String extension) {
        return UUID.randomUUID() + extension;
    }

    private StoredFile storeFile(
        MultipartFile file,
        Path targetPath,
        String storedFilename,
        long declaredSize,
        String uploadSessionId
    ) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");

            try (InputStream inputStream = file.getInputStream();
                 DigestInputStream digestStream = new DigestInputStream(inputStream, digest);
                 OutputStream outputStream = Files.newOutputStream(
                     targetPath,
                     StandardOpenOption.CREATE,
                     StandardOpenOption.TRUNCATE_EXISTING,
                     StandardOpenOption.WRITE
                 )) {
                byte[] buffer = new byte[1024 * 1024];
                long writtenBytes = 0L;
                int readBytes;

                while ((readBytes = digestStream.read(buffer)) >= 0) {
                    if (readBytes == 0) {
                        continue;
                    }

                    outputStream.write(buffer, 0, readBytes);
                    writtenBytes += readBytes;
                    updateUploadProcessedBytes(uploadSessionId, writtenBytes, declaredSize);
                }

                if (writtenBytes <= 0) {
                    deleteStoredFileIfExists(targetPath);
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El archivo esta vacio");
                }

                return new StoredFile(
                    storedFilename,
                    writtenBytes,
                    hex(digest.digest())
                );
            }
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 no disponible", ex);
        } catch (IOException ex) {
            deleteStoredFileIfExists(targetPath);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No se pudo guardar el archivo");
        }
    }

    private String extractFailureMessage(RuntimeException exception) {
        if (exception instanceof ResponseStatusException responseStatusException) {
            String reason = responseStatusException.getReason();
            if (reason != null && !reason.isBlank()) {
                return reason;
            }
        }

        String message = exception.getMessage();
        if (message != null && !message.isBlank()) {
            return message;
        }

        return "No se pudo subir el libro";
    }

    private UploadSessionSnapshot requireUploadSession(String sessionId) {
        UploadSessionSnapshot snapshot = uploadSessions.get(sessionId);
        if (snapshot == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Sesion de subida no encontrada");
        }
        return snapshot;
    }

    private void cleanupExpiredUploadSessions() {
        OffsetDateTime threshold = nowUtc().minus(UPLOAD_SESSION_TTL);
        uploadSessions.entrySet().removeIf((entry) -> entry.getValue().updatedAt().isBefore(threshold));
    }

    private OffsetDateTime nowUtc() {
        return OffsetDateTime.now(ZoneOffset.UTC);
    }

    private void markUploadProcessing(String sessionId, long totalBytes, String filename) {
        if (sessionId == null || sessionId.isBlank()) {
            return;
        }

        uploadSessions.computeIfPresent(
            sessionId,
            (ignored, current) -> current.withUpdate(
                "processing",
                0,
                0L,
                totalBytes > 0 ? totalBytes : null,
                null,
                filename,
                null
            )
        );
    }

    private void updateUploadProcessedBytes(String sessionId, long processedBytes, long totalBytes) {
        if (sessionId == null || sessionId.isBlank()) {
            return;
        }

        uploadSessions.computeIfPresent(
            sessionId,
            (ignored, current) -> {
                long safeProcessedBytes = Math.max(processedBytes, 0L);
                Long safeTotalBytes = totalBytes > 0 ? totalBytes : current.totalBytes();
                int percent = computeUploadProcessingPercent(safeProcessedBytes, safeTotalBytes);

                return current.withUpdate(
                    "processing",
                    percent,
                    safeProcessedBytes,
                    safeTotalBytes,
                    current.bookId(),
                    current.filename(),
                    null
                );
            }
        );
    }

    private void markUploadCompleted(String sessionId, Long bookId, String filename, long totalBytes) {
        if (sessionId == null || sessionId.isBlank()) {
            return;
        }

        uploadSessions.computeIfPresent(
            sessionId,
            (ignored, current) -> current.withUpdate(
                "completed",
                100,
                totalBytes > 0 ? totalBytes : current.processedBytes(),
                totalBytes > 0 ? totalBytes : current.totalBytes(),
                bookId,
                filename != null && !filename.isBlank() ? filename : current.filename(),
                null
            )
        );
    }

    private void markUploadFailed(String sessionId, String errorMessage) {
        if (sessionId == null || sessionId.isBlank()) {
            return;
        }

        uploadSessions.computeIfPresent(
            sessionId,
            (ignored, current) -> current.withUpdate(
                "failed",
                current.progressPercent(),
                current.processedBytes(),
                current.totalBytes(),
                current.bookId(),
                current.filename(),
                errorMessage
            )
        );
    }

    private int computeUploadProcessingPercent(long processedBytes, Long totalBytes) {
        if (totalBytes == null || totalBytes <= 0L) {
            return 0;
        }

        double rawPercent = (processedBytes * 100d) / totalBytes;
        int rounded = (int) Math.round(rawPercent);
        return Math.max(0, Math.min(99, rounded));
    }

    private BookUploadSessionDto toUploadSessionDto(UploadSessionSnapshot snapshot) {
        return new BookUploadSessionDto(
            snapshot.sessionId(),
            snapshot.status(),
            snapshot.progressPercent(),
            snapshot.processedBytes(),
            snapshot.totalBytes(),
            snapshot.bookId(),
            snapshot.filename(),
            snapshot.errorMessage(),
            snapshot.updatedAt()
        );
    }

    private record UploadSessionSnapshot(
        String sessionId,
        String status,
        Integer progressPercent,
        Long processedBytes,
        Long totalBytes,
        Long bookId,
        String filename,
        String errorMessage,
        OffsetDateTime updatedAt
    ) {
        private UploadSessionSnapshot withUpdate(
            String nextStatus,
            Integer nextProgressPercent,
            Long nextProcessedBytes,
            Long nextTotalBytes,
            Long nextBookId,
            String nextFilename,
            String nextErrorMessage
        ) {
            return new UploadSessionSnapshot(
                sessionId,
                nextStatus,
                nextProgressPercent,
                nextProcessedBytes,
                nextTotalBytes,
                nextBookId,
                nextFilename,
                nextErrorMessage,
                OffsetDateTime.now(ZoneOffset.UTC)
            );
        }
    }

    private String normalizeFilename(String originalFilename) {
        if (originalFilename == null) {
            return "libro.pdf";
        }

        String normalized = originalFilename.replace('\\', '/').trim();
        int lastSeparator = normalized.lastIndexOf('/');
        String filename = lastSeparator >= 0 ? normalized.substring(lastSeparator + 1) : normalized;
        if (filename.isBlank()) {
            return "libro.pdf";
        }

        return filename;
    }

    private String extensionOf(String filename) {
        int lastDot = filename.lastIndexOf('.');
        if (lastDot < 0 || lastDot == filename.length() - 1) {
            return "";
        }

        return filename.substring(lastDot).toLowerCase(Locale.ROOT);
    }

    private String resolveContentType(String contentType, String extension) {
        String normalized = contentType == null ? "" : contentType.trim().toLowerCase(Locale.ROOT);
        if (!normalized.isEmpty() && !"application/octet-stream".equals(normalized)) {
            return normalized;
        }

        return switch (extension) {
            case ".pdf" -> "application/pdf";
            case ".epub" -> "application/epub+zip";
            case ".txt" -> "text/plain";
            case ".md" -> "text/markdown";
            default -> "application/octet-stream";
        };
    }

    private Path resolveStoredPath(MediaAssetEntity entity) {
        String storagePath = entity.getStoragePath();
        if (storagePath == null || storagePath.isBlank()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Ruta del libro no disponible");
        }

        Path resolved = booksStorageRoot.resolve(storagePath).normalize();
        if (!resolved.startsWith(booksStorageRoot)) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Ruta del libro invalida");
        }
        return resolved;
    }

    private void deleteStoredFileIfExists(Path path) {
        try {
            Files.deleteIfExists(path);
        } catch (IOException ex) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "No se pudo eliminar el archivo del libro");
        }
    }

    private String hex(byte[] hash) {
        StringBuilder builder = new StringBuilder(hash.length * 2);
        for (byte item : hash) {
            builder.append(String.format("%02x", item & 0xff));
        }
        return builder.toString();
    }

    private BookDto toDto(MediaAssetEntity entity) {
        return new BookDto(
            entity.getId(),
            entity.getFilename(),
            entity.getContentType(),
            entity.getByteSize(),
            "/v1/books/" + entity.getId(),
            entity.getCreatedAt(),
            entity.getUpdatedAt()
        );
    }

    public record BookDownload(
        String filename,
        String contentType,
        Long byteSize,
        Resource body
    ) {
    }

    private record StoredFile(
        String storagePath,
        Long byteSize,
        String checksumSha256
    ) {
    }
}
