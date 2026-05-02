package com.sistema.dnd.sistema.services;

import com.sistema.dnd.sistema.dto.domain.DmOpenLoopDto;
import com.sistema.dnd.sistema.dto.domain.DmOpenLoopUpsertRequest;
import com.sistema.dnd.sistema.entity.DmOpenLoopEntity;
import com.sistema.dnd.sistema.repository.DmOpenLoopRepository;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DmOpenLoopService {

    private static final Set<String> ALLOWED_TYPES = Set.of(
        "rescue",
        "threat",
        "sidequest",
        "opportunity",
        "plan",
        "bounty",
        "mystery",
        "debt"
    );
    private static final Set<String> ALLOWED_STATUSES = Set.of(
        "open",
        "in-progress",
        "blocked",
        "urgent",
        "resolved",
        "failed"
    );
    private static final Set<String> ALLOWED_PRIORITIES = Set.of("low", "medium", "high", "critical");

    private final DmOpenLoopRepository dmOpenLoopRepository;

    public DmOpenLoopService(DmOpenLoopRepository dmOpenLoopRepository) {
        this.dmOpenLoopRepository = dmOpenLoopRepository;
    }

    public List<DmOpenLoopDto> findAll() {
        return dmOpenLoopRepository.findAllByOrderByUpdatedAtDescIdDesc().stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    public DmOpenLoopDto create(DmOpenLoopUpsertRequest request) {
        DmOpenLoopEntity entity = new DmOpenLoopEntity();
        apply(entity, request);
        return toDto(dmOpenLoopRepository.save(entity));
    }

    @Transactional
    public DmOpenLoopDto update(Long id, DmOpenLoopUpsertRequest request) {
        DmOpenLoopEntity entity = dmOpenLoopRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Open Loop no encontrado"));

        apply(entity, request);
        return toDto(dmOpenLoopRepository.save(entity));
    }

    @Transactional
    public void delete(Long id) {
        DmOpenLoopEntity entity = dmOpenLoopRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Open Loop no encontrado"));

        dmOpenLoopRepository.delete(entity);
    }

    private void apply(DmOpenLoopEntity entity, DmOpenLoopUpsertRequest request) {
        entity.setTitle(requiredTrimmed(request.title(), "El titulo es obligatorio"));
        entity.setLoopType(normalizeAllowedValue(request.loopType(), ALLOWED_TYPES, "El tipo no es valido"));
        entity.setStatus(normalizeAllowedValue(request.status(), ALLOWED_STATUSES, "El estado no es valido"));
        entity.setPriority(normalizeAllowedValue(request.priority(), ALLOWED_PRIORITIES, "La prioridad no es valida"));
        entity.setSummary(requiredTrimmed(request.summary(), "El resumen es obligatorio"));
        entity.setNextStep(normalizedOrNull(request.nextStep()));
        entity.setConsequence(normalizedOrNull(request.consequence()));
        entity.setReward(normalizedOrNull(request.reward()));
        entity.setLocation(normalizedOrNull(request.location()));
        entity.setDueAt(request.dueAt());
        entity.setNotes(normalizedOrNull(request.notes()));
    }

    private DmOpenLoopDto toDto(DmOpenLoopEntity entity) {
        return new DmOpenLoopDto(
            entity.getId(),
            entity.getTitle(),
            entity.getLoopType(),
            entity.getStatus(),
            entity.getPriority(),
            entity.getSummary(),
            entity.getNextStep(),
            entity.getConsequence(),
            entity.getReward(),
            entity.getLocation(),
            entity.getDueAt(),
            entity.getNotes(),
            entity.getCreatedAt(),
            entity.getUpdatedAt()
        );
    }

    private String normalizeAllowedValue(String value, Set<String> allowedValues, String message) {
        String normalized = requiredTrimmed(value, message).toLowerCase(Locale.ROOT);
        if (!allowedValues.contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return normalized;
    }

    private String requiredTrimmed(String value, String message) {
        if (value == null || value.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return value.trim();
    }

    private String normalizedOrNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
