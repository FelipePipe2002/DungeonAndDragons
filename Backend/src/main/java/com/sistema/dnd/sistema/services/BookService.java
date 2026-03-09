package com.sistema.dnd.sistema.services;

import com.sistema.dnd.sistema.dto.domain.BookDto;
import com.sistema.dnd.sistema.dto.domain.BookUploadSessionDto;
import com.sistema.dnd.sistema.entity.MediaAssetEntity;
import com.sistema.dnd.sistema.entity.MediaAssetKind;
import com.sistema.dnd.sistema.entity.MediaAssetStorageMode;
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
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
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

    private final MediaAssetRepository mediaAssetRepository;
    private final BookUploadProgressService bookUploadProgressService;
    private final Path booksStorageRoot;

    public BookService(
        MediaAssetRepository mediaAssetRepository,
        BookUploadProgressService bookUploadProgressService,
        @Value("${app.storage.books-dir:storage/books}") String booksStorageDir
    ) {
        this.mediaAssetRepository = mediaAssetRepository;
        this.bookUploadProgressService = bookUploadProgressService;
        this.booksStorageRoot = Paths.get(booksStorageDir).toAbsolutePath().normalize();
    }

    public List<BookDto> findAll() {
        return mediaAssetRepository.findAllByKindOrderByFilenameAsc(MediaAssetKind.book)
            .stream()
            .map(this::toDto)
            .toList();
    }

    public BookUploadSessionDto createUploadSession() {
        return bookUploadProgressService.createSession();
    }

    public BookUploadSessionDto getUploadSession(String sessionId) {
        return bookUploadProgressService.getStatus(sessionId);
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
        bookUploadProgressService.markProcessing(uploadSessionId, declaredSize, filename);

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
                bookUploadProgressService.markCompleted(uploadSessionId, saved.getId(), saved.getFilename(), storedFile.byteSize());
                return toDto(saved);
            } catch (RuntimeException ex) {
                deleteStoredFileIfExists(targetPath);
                bookUploadProgressService.markFailed(uploadSessionId, extractFailureMessage(ex));
                throw ex;
            }
        } catch (RuntimeException ex) {
            deleteStoredFileIfExists(targetPath);
            bookUploadProgressService.markFailed(uploadSessionId, extractFailureMessage(ex));
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
                    bookUploadProgressService.updateProcessedBytes(uploadSessionId, writtenBytes, declaredSize);
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
