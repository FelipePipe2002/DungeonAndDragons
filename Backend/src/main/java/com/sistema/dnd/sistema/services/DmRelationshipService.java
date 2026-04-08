package com.sistema.dnd.sistema.services;

import com.sistema.dnd.sistema.dto.domain.DmRelationshipDto;
import com.sistema.dnd.sistema.dto.domain.DmRelationshipUpsertRequest;
import com.sistema.dnd.sistema.entity.DmRelationshipEntity;
import com.sistema.dnd.sistema.repository.DmRelationshipRepository;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DmRelationshipService {

    private static final Set<String> ALLOWED_ENTITY_TYPES = Set.of("character", "building", "organization", "landmark");
    private static final Set<String> ALLOWED_DIRECTIONS = Set.of("left-to-right", "right-to-left", "both");

    private final DmRelationshipRepository dmRelationshipRepository;

    public DmRelationshipService(DmRelationshipRepository dmRelationshipRepository) {
        this.dmRelationshipRepository = dmRelationshipRepository;
    }

    public List<DmRelationshipDto> findAll() {
        return dmRelationshipRepository.findAllByOrderByUpdatedAtDescIdDesc().stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    public DmRelationshipDto create(DmRelationshipUpsertRequest request) {
        DmRelationshipEntity entity = new DmRelationshipEntity();
        apply(entity, request);
        return toDto(dmRelationshipRepository.save(entity));
    }

    @Transactional
    public DmRelationshipDto update(Long id, DmRelationshipUpsertRequest request) {
        DmRelationshipEntity entity = dmRelationshipRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Relacion no encontrada"));

        apply(entity, request);
        return toDto(dmRelationshipRepository.save(entity));
    }

    @Transactional
    public void delete(Long id) {
        DmRelationshipEntity entity = dmRelationshipRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Relacion no encontrada"));

        dmRelationshipRepository.delete(entity);
    }

    private void apply(DmRelationshipEntity entity, DmRelationshipUpsertRequest request) {
        entity.setLeftEntityType(normalizeEntityType(request.leftEntityType()));
        entity.setLeftEntityId(requirePositiveId(request.leftEntityId(), "La entidad izquierda es obligatoria"));
        entity.setRightEntityType(normalizeEntityType(request.rightEntityType()));
        entity.setRightEntityId(requirePositiveId(request.rightEntityId(), "La entidad derecha es obligatoria"));
        entity.setDirection(normalizeDirection(request.direction()));
        entity.setLabel(requiredTrimmed(request.label(), "La etiqueta es obligatoria"));
        entity.setNotes(normalizedOrNull(request.notes()));
    }

    private DmRelationshipDto toDto(DmRelationshipEntity entity) {
        return new DmRelationshipDto(
            entity.getId(),
            entity.getLeftEntityType(),
            entity.getLeftEntityId(),
            entity.getRightEntityType(),
            entity.getRightEntityId(),
            entity.getDirection(),
            entity.getLabel(),
            entity.getNotes(),
            entity.getCreatedAt(),
            entity.getUpdatedAt()
        );
    }

    private String normalizeEntityType(String value) {
        String normalized = requiredTrimmed(value, "El tipo de entidad es obligatorio").toLowerCase(Locale.ROOT);
        if (!ALLOWED_ENTITY_TYPES.contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El tipo de entidad no es valido");
        }
        return normalized;
    }

    private String normalizeDirection(String value) {
        String normalized = requiredTrimmed(value, "La direccion es obligatoria").toLowerCase(Locale.ROOT);
        if (!ALLOWED_DIRECTIONS.contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La direccion no es valida");
        }
        return normalized;
    }

    private Long requirePositiveId(Long value, String message) {
        if (value == null || value < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return value;
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
