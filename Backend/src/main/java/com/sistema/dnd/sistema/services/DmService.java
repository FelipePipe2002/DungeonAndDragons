package com.sistema.dnd.sistema.services;

import com.sistema.dnd.sistema.dto.domain.DmNotesDto;
import com.sistema.dnd.sistema.dto.domain.DmOpenLoopDto;
import com.sistema.dnd.sistema.dto.domain.DmRelationshipDto;
import com.sistema.dnd.sistema.dto.domain.EventDto;
import com.sistema.dnd.sistema.entity.DmNotesEntity;
import com.sistema.dnd.sistema.entity.DmOpenLoopEntity;
import com.sistema.dnd.sistema.entity.DmRelationshipEntity;
import com.sistema.dnd.sistema.entity.EventEntity;
import com.sistema.dnd.sistema.entity.enums.EventOwnerType;
import com.sistema.dnd.sistema.repository.DmNotesRepository;
import com.sistema.dnd.sistema.repository.DmOpenLoopRepository;
import com.sistema.dnd.sistema.repository.DmRelationshipRepository;
import com.sistema.dnd.sistema.repository.EventRepository;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DmService {

    private static final long SINGLETON_NOTES_ID = 1L;
    private static final Set<String> ALLOWED_LOOP_TYPES = Set.of(
        "rescue",
        "threat",
        "sidequest",
        "opportunity",
        "plan",
        "bounty",
        "mystery",
        "debt"
    );
    private static final Set<String> ALLOWED_LOOP_STATUSES = Set.of(
        "open",
        "in-progress",
        "blocked",
        "urgent",
        "resolved",
        "failed"
    );
    private static final Set<String> ALLOWED_LOOP_PRIORITIES = Set.of("low", "medium", "high", "critical");
    private static final Set<String> ALLOWED_RELATIONSHIP_ENTITY_TYPES = Set.of(
        "character",
        "building",
        "organization",
        "landmark"
    );
    private static final Set<String> ALLOWED_RELATIONSHIP_DIRECTIONS = Set.of("left-to-right", "right-to-left", "both");

    private final EventRepository eventRepository;
    private final DmNotesRepository dmNotesRepository;
    private final DmOpenLoopRepository dmOpenLoopRepository;
    private final DmRelationshipRepository dmRelationshipRepository;

    public DmService(
        EventRepository eventRepository,
        DmNotesRepository dmNotesRepository,
        DmOpenLoopRepository dmOpenLoopRepository,
        DmRelationshipRepository dmRelationshipRepository
    ) {
        this.eventRepository = eventRepository;
        this.dmNotesRepository = dmNotesRepository;
        this.dmOpenLoopRepository = dmOpenLoopRepository;
        this.dmRelationshipRepository = dmRelationshipRepository;
    }

    public List<EventDto> findAllEvents() {
        return eventRepository.findByOwnerTypeOrderByIdDesc(EventOwnerType.dm).stream()
            .map(this::toEventDto)
            .toList();
    }

    @Transactional
    public EventDto createEvent(EventDto request) {
        EventEntity entity = new EventEntity();
        entity.setOwnerType(EventOwnerType.dm);
        entity.setTitulo(requiredTrimmed(request.title(), "El titulo del evento es obligatorio"));
        entity.setDescripcion(normalizedOrEmpty(request.description()));
        entity.setFecha(optionalTrimmed(request.date()));
        entity.setSesion(optionalTrimmed(request.session()));
        return toEventDto(eventRepository.save(entity));
    }

    @Transactional
    public void deleteEvent(Long id) {
        EventEntity entity = eventRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Evento no encontrado"));

        if (entity.getOwnerType() != EventOwnerType.dm) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Evento no encontrado");
        }

        eventRepository.delete(entity);
    }

    @Transactional
    public DmNotesDto findNotes() {
        return toNotesDto(getOrCreateNotesSingleton());
    }

    @Transactional
    public DmNotesDto updateNotes(DmNotesDto request) {
        DmNotesEntity entity = getOrCreateNotesSingleton();
        entity.setTexto(normalizedOrEmpty(request.text()));
        return toNotesDto(dmNotesRepository.save(entity));
    }

    public List<DmOpenLoopDto> findAllOpenLoops() {
        return dmOpenLoopRepository.findAllByOrderByUpdatedAtDescIdDesc().stream()
            .map(this::toOpenLoopDto)
            .toList();
    }

    @Transactional
    public DmOpenLoopDto createOpenLoop(DmOpenLoopDto request) {
        DmOpenLoopEntity entity = new DmOpenLoopEntity();
        applyOpenLoop(entity, request);
        return toOpenLoopDto(dmOpenLoopRepository.save(entity));
    }

    @Transactional
    public DmOpenLoopDto updateOpenLoop(Long id, DmOpenLoopDto request) {
        DmOpenLoopEntity entity = dmOpenLoopRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Open Loop no encontrado"));

        applyOpenLoop(entity, request);
        return toOpenLoopDto(dmOpenLoopRepository.save(entity));
    }

    @Transactional
    public void deleteOpenLoop(Long id) {
        DmOpenLoopEntity entity = dmOpenLoopRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Open Loop no encontrado"));

        dmOpenLoopRepository.delete(entity);
    }

    public List<DmRelationshipDto> findAllRelationships() {
        return dmRelationshipRepository.findAllByOrderByUpdatedAtDescIdDesc().stream()
            .map(this::toRelationshipDto)
            .toList();
    }

    @Transactional
    public DmRelationshipDto createRelationship(DmRelationshipDto request) {
        DmRelationshipEntity entity = new DmRelationshipEntity();
        applyRelationship(entity, request);
        return toRelationshipDto(dmRelationshipRepository.save(entity));
    }

    @Transactional
    public DmRelationshipDto updateRelationship(Long id, DmRelationshipDto request) {
        DmRelationshipEntity entity = dmRelationshipRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Relacion no encontrada"));

        applyRelationship(entity, request);
        return toRelationshipDto(dmRelationshipRepository.save(entity));
    }

    @Transactional
    public void deleteRelationship(Long id) {
        DmRelationshipEntity entity = dmRelationshipRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Relacion no encontrada"));

        dmRelationshipRepository.delete(entity);
    }

    private DmNotesEntity getOrCreateNotesSingleton() {
        return dmNotesRepository.findById(SINGLETON_NOTES_ID)
            .orElseGet(() -> {
                DmNotesEntity entity = new DmNotesEntity();
                entity.setId(SINGLETON_NOTES_ID);
                entity.setTexto("");
                return dmNotesRepository.save(entity);
            });
    }

    private void applyOpenLoop(DmOpenLoopEntity entity, DmOpenLoopDto request) {
        entity.setTitle(requiredTrimmed(request.title(), "El titulo es obligatorio"));
        entity.setLoopType(normalizeAllowedValue(request.loopType(), ALLOWED_LOOP_TYPES, "El tipo no es valido"));
        entity.setStatus(normalizeAllowedValue(request.status(), ALLOWED_LOOP_STATUSES, "El estado no es valido"));
        entity.setPriority(normalizeAllowedValue(request.priority(), ALLOWED_LOOP_PRIORITIES, "La prioridad no es valida"));
        entity.setSummary(requiredTrimmed(request.summary(), "El resumen es obligatorio"));
        entity.setNextStep(normalizedOrNull(request.nextStep()));
        entity.setConsequence(normalizedOrNull(request.consequence()));
        entity.setReward(normalizedOrNull(request.reward()));
        entity.setLocation(normalizedOrNull(request.location()));
        entity.setDueAt(request.dueAt());
        entity.setNotes(normalizedOrNull(request.notes()));
    }

    private void applyRelationship(DmRelationshipEntity entity, DmRelationshipDto request) {
        entity.setLeftEntityType(normalizeRelationshipEntityType(request.leftEntityType()));
        entity.setLeftEntityId(requirePositiveId(request.leftEntityId(), "La entidad izquierda es obligatoria"));
        entity.setRightEntityType(normalizeRelationshipEntityType(request.rightEntityType()));
        entity.setRightEntityId(requirePositiveId(request.rightEntityId(), "La entidad derecha es obligatoria"));
        entity.setDirection(normalizeRelationshipDirection(request.direction()));
        entity.setLabel(requiredTrimmed(request.label(), "La etiqueta es obligatoria"));
        entity.setNotes(normalizedOrNull(request.notes()));
    }

    private EventDto toEventDto(EventEntity entity) {
        return new EventDto(
            entity.getId(),
            entity.getTitulo(),
            entity.getDescripcion(),
            entity.getFecha(),
            entity.getSesion()
        );
    }

    private DmNotesDto toNotesDto(DmNotesEntity entity) {
        return new DmNotesDto(normalizedOrEmpty(entity.getTexto()));
    }

    private DmOpenLoopDto toOpenLoopDto(DmOpenLoopEntity entity) {
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
            entity.getNotes()
        );
    }

    private DmRelationshipDto toRelationshipDto(DmRelationshipEntity entity) {
        return new DmRelationshipDto(
            entity.getId(),
            entity.getLeftEntityType(),
            entity.getLeftEntityId(),
            entity.getRightEntityType(),
            entity.getRightEntityId(),
            entity.getDirection(),
            entity.getLabel(),
            entity.getNotes()
        );
    }

    private String normalizeRelationshipEntityType(String value) {
        String normalized = requiredTrimmed(value, "El tipo de entidad es obligatorio").toLowerCase(Locale.ROOT);
        if (!ALLOWED_RELATIONSHIP_ENTITY_TYPES.contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El tipo de entidad no es valido");
        }
        return normalized;
    }

    private String normalizeRelationshipDirection(String value) {
        String normalized = requiredTrimmed(value, "La direccion es obligatoria").toLowerCase(Locale.ROOT);
        if (!ALLOWED_RELATIONSHIP_DIRECTIONS.contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La direccion no es valida");
        }
        return normalized;
    }

    private String normalizeAllowedValue(String value, Set<String> allowedValues, String message) {
        String normalized = requiredTrimmed(value, message).toLowerCase(Locale.ROOT);
        if (!allowedValues.contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
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

    private String optionalTrimmed(String value) {
        return normalizedOrNull(value);
    }

    private String normalizedOrEmpty(String value) {
        if (value == null) return "";
        return value;
    }
}
