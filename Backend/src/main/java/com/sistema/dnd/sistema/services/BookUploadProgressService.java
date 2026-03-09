package com.sistema.dnd.sistema.services;

import com.sistema.dnd.sistema.dto.domain.BookUploadSessionDto;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class BookUploadProgressService {

    private static final Duration SESSION_TTL = Duration.ofHours(6);

    private final ConcurrentHashMap<String, SessionSnapshot> sessions = new ConcurrentHashMap<>();

    public BookUploadSessionDto createSession() {
        cleanupExpiredSessions();

        String sessionId = UUID.randomUUID().toString();
        SessionSnapshot snapshot = new SessionSnapshot(
            sessionId,
            "awaiting_upload",
            0,
            0L,
            null,
            null,
            null,
            null,
            now()
        );
        sessions.put(sessionId, snapshot);
        return toDto(snapshot);
    }

    public BookUploadSessionDto getStatus(String sessionId) {
        cleanupExpiredSessions();
        return toDto(getRequiredSession(sessionId));
    }

    public void markProcessing(String sessionId, long totalBytes, String filename) {
        if (sessionId == null || sessionId.isBlank()) {
            return;
        }

        sessions.computeIfPresent(
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

    public void updateProcessedBytes(String sessionId, long processedBytes, long totalBytes) {
        if (sessionId == null || sessionId.isBlank()) {
            return;
        }

        sessions.computeIfPresent(
            sessionId,
            (ignored, current) -> {
                long safeProcessedBytes = Math.max(processedBytes, 0L);
                Long safeTotalBytes = totalBytes > 0 ? totalBytes : current.totalBytes();
                int percent = computeProcessingPercent(safeProcessedBytes, safeTotalBytes);

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

    public void markCompleted(String sessionId, Long bookId, String filename, long totalBytes) {
        if (sessionId == null || sessionId.isBlank()) {
            return;
        }

        sessions.computeIfPresent(
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

    public void markFailed(String sessionId, String errorMessage) {
        if (sessionId == null || sessionId.isBlank()) {
            return;
        }

        sessions.computeIfPresent(
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

    private SessionSnapshot getRequiredSession(String sessionId) {
        SessionSnapshot snapshot = sessions.get(sessionId);
        if (snapshot == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Sesion de subida no encontrada");
        }
        return snapshot;
    }

    private void cleanupExpiredSessions() {
        OffsetDateTime threshold = now().minus(SESSION_TTL);
        sessions.entrySet().removeIf((entry) -> entry.getValue().updatedAt().isBefore(threshold));
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now(ZoneOffset.UTC);
    }

    private int computeProcessingPercent(long processedBytes, Long totalBytes) {
        if (totalBytes == null || totalBytes <= 0L) {
            return 0;
        }

        double rawPercent = (processedBytes * 100d) / totalBytes;
        int rounded = (int) Math.round(rawPercent);
        return Math.max(0, Math.min(99, rounded));
    }

    private BookUploadSessionDto toDto(SessionSnapshot snapshot) {
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

    private record SessionSnapshot(
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
        private SessionSnapshot withUpdate(
            String nextStatus,
            Integer nextProgressPercent,
            Long nextProcessedBytes,
            Long nextTotalBytes,
            Long nextBookId,
            String nextFilename,
            String nextErrorMessage
        ) {
            return new SessionSnapshot(
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
}
