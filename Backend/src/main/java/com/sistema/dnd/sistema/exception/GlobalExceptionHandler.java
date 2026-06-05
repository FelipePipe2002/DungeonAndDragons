package com.sistema.dnd.sistema.exception;

import com.sistema.dnd.sistema.services.BookService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;
import org.slf4j.MDC;

import java.time.ZonedDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    private final BookService bookService;

    public GlobalExceptionHandler(BookService bookService) {
        this.bookService = bookService;
    }

    private Map<String, Object> baseBody(HttpStatus status, String message, HttpServletRequest request) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", ZonedDateTime.now().toString());
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("message", message);
        body.put("path", request.getRequestURI());
        String requestId = MDC.get("requestId");
        if (requestId != null) {
            body.put("requestId", requestId);
        }
        return body;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest request) {
        List<Map<String, String>> errors = ex.getBindingResult().getAllErrors().stream()
                .map(err -> {
                    Map<String, String> e = new HashMap<>();
                    if (err instanceof FieldError fe) {
                        e.put("field", fe.getField());
                        e.put("message", fe.getDefaultMessage());
                    } else {
                        e.put("field", err.getObjectName());
                        e.put("message", err.getDefaultMessage());
                    }
                    return e;
                }).collect(Collectors.toList());
        HttpStatus status = HttpStatus.BAD_REQUEST;
        Map<String, Object> body = baseBody(status, "Error de validación", request);
        body.put("errors", errors);
        log.warn("[{}] Validation error on {}: {}", MDC.get("requestId"), request.getRequestURI(), errors);
        return ResponseEntity.status(status).body(body);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleNotReadable(HttpMessageNotReadableException ex, HttpServletRequest request) {
        HttpStatus status = HttpStatus.BAD_REQUEST;
        Map<String, Object> body = baseBody(status, "Cuerpo de la solicitud inválido", request);
        body.put("detail", ex.getMostSpecificCause() != null ? ex.getMostSpecificCause().getMessage() : ex.getMessage());
        log.warn("[{}] Body parse error on {}: {}", MDC.get("requestId"), request.getRequestURI(), ex.getMessage());
        return ResponseEntity.status(status).body(body);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> handleDataIntegrity(DataIntegrityViolationException ex, HttpServletRequest request) {
        HttpStatus status = HttpStatus.CONFLICT;
        String msg = ex.getMostSpecificCause() != null ? ex.getMostSpecificCause().getMessage() : ex.getMessage();
        Map<String, Object> body = baseBody(status, "Violación de integridad de datos", request);
        body.put("detail", msg);
        log.error("[{}] Data integrity violation on {}: {}", MDC.get("requestId"), request.getRequestURI(), msg);
        return ResponseEntity.status(status).body(body);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException ex, HttpServletRequest request) {
        HttpStatus status = HttpStatus.FORBIDDEN;
        Map<String, Object> body = baseBody(status, "Acceso denegado", request);
        log.warn("[{}] Access denied on {}", MDC.get("requestId"), request.getRequestURI());
        return ResponseEntity.status(status).body(body);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleResponseStatus(ResponseStatusException ex, HttpServletRequest request) {
        HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
        if (status == null) status = HttpStatus.INTERNAL_SERVER_ERROR;
        Map<String, Object> body = baseBody(status, ex.getReason(), request);
        log.warn("[{}] ResponseStatusException on {}: {}", MDC.get("requestId"), request.getRequestURI(), ex.getReason());
        return ResponseEntity.status(status).body(body);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleMaxUpload(MaxUploadSizeExceededException ex, HttpServletRequest request) {
        HttpStatus status = HttpStatus.PAYLOAD_TOO_LARGE;
        String uploadSessionId = request.getParameter("uploadSessionId");
        if (uploadSessionId != null && !uploadSessionId.isBlank()) {
            bookService.markUploadSessionFailed(uploadSessionId, "El archivo supera el tamano maximo permitido de 500 MB");
        }

        Map<String, Object> body = baseBody(status, "El archivo supera el tamano maximo permitido de 500 MB", request);
        String detail = ex.getMostSpecificCause() != null ? ex.getMostSpecificCause().getMessage() : ex.getMessage();
        if (detail != null && !detail.isBlank()) {
            body.put("detail", detail);
        }
        log.warn("[{}] Upload too large on {}: {}", MDC.get("requestId"), request.getRequestURI(), detail);
        return ResponseEntity.status(status).body(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneric(Exception ex, HttpServletRequest request) {
        HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;
        Map<String, Object> body = baseBody(status, "Error interno", request);
        body.put("exception", ex.getClass().getSimpleName());
        String msg = ex.getMessage();
        if (msg != null && !msg.isBlank()) body.put("detail", msg);
        log.error("[{}] Unhandled exception on {}: {}", MDC.get("requestId"), request.getRequestURI(), ex.toString(), ex);
        return ResponseEntity.status(status).body(body);
    }
}
