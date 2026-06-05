package com.sistema.dnd.sistema.services;

import com.sistema.dnd.sistema.dto.domain.LandmarkDto;
import com.sistema.dnd.sistema.dto.domain.EventDto;
import com.sistema.dnd.sistema.dto.domain.LandmarkMapRequest;
import com.sistema.dnd.sistema.dto.domain.LandmarkUpsertRequest;
import com.sistema.dnd.sistema.entity.EstadoEntity;
import com.sistema.dnd.sistema.entity.EventEntity;
import com.sistema.dnd.sistema.entity.LandmarkEntity;
import com.sistema.dnd.sistema.entity.enums.LandmarkMapKind;
import com.sistema.dnd.sistema.entity.enums.LandmarkMapSource;
import com.sistema.dnd.sistema.entity.MediaAssetEntity;
import com.sistema.dnd.sistema.entity.enums.EventOwnerType;
import com.sistema.dnd.sistema.entity.enums.TaggableEntityType;
import com.sistema.dnd.sistema.repository.EstadoRepository;
import com.sistema.dnd.sistema.repository.EventRepository;
import com.sistema.dnd.sistema.repository.LandmarkRepository;
import jakarta.transaction.Transactional;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class LandmarkService {

    private final LandmarkRepository landmarkRepository;
    private final EventRepository eventRepository;
    private final EstadoRepository estadoRepository;
    private final TaggingService taggingService;
    private final DomainMapper domainMapper;
    private final LandmarkMapValidator landmarkMapValidator;

    public LandmarkService(
        LandmarkRepository landmarkRepository,
        EventRepository eventRepository,
        EstadoRepository estadoRepository,
        TaggingService taggingService,
        DomainMapper domainMapper,
        LandmarkMapValidator landmarkMapValidator
    ) {
        this.landmarkRepository = landmarkRepository;
        this.eventRepository = eventRepository;
        this.estadoRepository = estadoRepository;
        this.taggingService = taggingService;
        this.domainMapper = domainMapper;
        this.landmarkMapValidator = landmarkMapValidator;
    }

    public List<LandmarkDto> findAll(String include) {
        IncludeOptions options = IncludeOptions.parse(include);
        return landmarkRepository.findAll().stream()
            .map(item -> domainMapper.toLandmarkDto(
                item,
                options.includeBuildings,
                options.includeCharacters,
                options.includeOrganizations
            ))
            .toList();
    }

    public LandmarkDto findById(Long id, String include) {
        LandmarkEntity entity = landmarkRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Landmark no encontrado"));

        IncludeOptions options = IncludeOptions.parse(include);
        return domainMapper.toLandmarkDto(
            entity,
            options.includeBuildings,
            options.includeCharacters,
            options.includeOrganizations
        );
    }

    @Transactional
    public LandmarkDto create(LandmarkUpsertRequest request) {
        MediaAssetEntity mapAsset = landmarkMapValidator.resolveValidatedMapAsset(request);
        LandmarkEntity entity = new LandmarkEntity();
        applyUpsert(entity, request);
        LandmarkEntity saved = landmarkRepository.save(entity);
        syncChildren(saved, request, mapAsset);
        return domainMapper.toLandmarkDto(saved, false, false, false);
    }

    @Transactional
    public LandmarkDto update(Long id, LandmarkUpsertRequest request) {
        LandmarkEntity entity = landmarkRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Landmark no encontrado"));
        MediaAssetEntity mapAsset = landmarkMapValidator.resolveValidatedMapAsset(request);

        applyUpsert(entity, request);
        LandmarkEntity saved = landmarkRepository.save(entity);
        syncChildren(saved, request, mapAsset);
        return domainMapper.toLandmarkDto(saved, false, false, false);
    }

    @Transactional
    public void delete(Long id) {
        LandmarkEntity entity = landmarkRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Landmark no encontrado"));
        landmarkRepository.delete(entity);
    }

    private void applyUpsert(LandmarkEntity entity, LandmarkUpsertRequest request) {
        EstadoEntity estado = null;
        if (request.stateId() != null && request.stateId() > 0) {
            estado = estadoRepository.findById(request.stateId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "stateId invalido"));
        }

        EstadoEntity subdivision = null;
        if (request.subdivisionId() != null && request.subdivisionId() > 0) {
            if (estado == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "subdivisionId requiere stateId");
            }
            subdivision = estadoRepository.findById(request.subdivisionId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "subdivisionId invalido"));
            if (subdivision.getEstadoPadre() == null || subdivision.getEstadoPadre().getId() == null || !subdivision.getEstadoPadre().getId().equals(estado.getId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La subdivision no pertenece al estado");
            }
        }

        entity.setIcono(normalizedOrEmpty(request.icon()));
        entity.setNombre(requiredTrimmed(request.name(), "El nombre del landmark es obligatorio"));
        entity.setTipo(request.type());
        entity.setEstado(estado);
        entity.setSubdivision(subdivision);
        entity.setEscalaIcono(request.iconScale());
        entity.setEscalaTexto(request.textScale());
        entity.setMostrarLeyenda(request.showLegend());
        entity.setPosicionX(request.position().get(0));
        entity.setPosicionY(request.position().get(1));
        entity.setPoblacion(request.population());
        entity.setDescripcionCorta(optionalTrimmed(request.shortDescription()));
        entity.setHistoria(optionalTrimmed(request.history()));
        entity.setMapRotationDegrees(normalizeMapRotationDegrees(request.mapRotationDegrees()));
        entity.setMapGridEnabled(Boolean.TRUE.equals(request.mapGridEnabled()));
        entity.setMapGridCellSize(normalizeMapGridCellSize(request.mapGridCellSize()));
        entity.setMapGridOffsetX(normalizeMapGridOffset(request.mapGridOffsetX()));
        entity.setMapGridOffsetY(normalizeMapGridOffset(request.mapGridOffsetY()));
        entity.setOrganizationMapLinks(optionalTrimmed(request.organizationMapLinks()));
        entity.setHiddenMapBuildings(optionalTrimmed(request.hiddenMapBuildings()));
        entity.setDungeonGeneratorConfig(optionalTrimmed(request.dungeonGeneratorConfig()));
    }

    private void syncChildren(LandmarkEntity landmark, LandmarkUpsertRequest request, MediaAssetEntity mapAsset) {
        eventRepository.deleteByOwnerTypeAndOwnerId(EventOwnerType.landmark, landmark.getId());
        eventRepository.flush();
        taggingService.replaceTags(TaggableEntityType.landmark, landmark.getId(), request.tags());

        if (mapAsset != null) {
            landmark.setMapAsset(mapAsset);
        } else {
            landmark.setMapAsset(null);
        }

        for (EventDto event : request.events() == null ? List.<EventDto>of() : request.events()) {
            EventEntity item = new EventEntity();
            item.setOwnerType(EventOwnerType.landmark);
            item.setOwnerId(landmark.getId());
            item.setTitulo(requiredTrimmed(event.title(), "El titulo del evento es obligatorio"));
            item.setDescripcion(normalizedOrEmpty(event.description()));
            item.setFecha(optionalTrimmed(event.date()));
            item.setSesion(optionalTrimmed(event.session()));
            eventRepository.save(item);
        }

        if (landmark.getMapAsset() != null) {
            clearInlineMapRef(landmark);
            return;
        }

        if (request.map() != null) {
            LandmarkMapRequest map = request.map();
            validateMap(map);
            landmark.setMapKind(map.kind());
            landmark.setMapSource(map.source());
            landmark.setMapFilename(optionalTrimmed(map.filename()));
            landmark.setMapUrl(optionalTrimmed(map.url()));
            landmark.setMapStorageKey(optionalTrimmed(map.key()));
            landmark.setMapDataUrl(optionalTrimmed(map.dataUrl()));
            return;
        }

        clearInlineMapRef(landmark);
    }

    private void clearInlineMapRef(LandmarkEntity landmark) {
        landmark.setMapKind(null);
        landmark.setMapSource(null);
        landmark.setMapFilename(null);
        landmark.setMapUrl(null);
        landmark.setMapStorageKey(null);
        landmark.setMapDataUrl(null);
    }

    private void validateMap(LandmarkMapRequest map) {
        LandmarkMapKind kind = map.kind();
        String filename = optionalTrimmed(map.filename());
        String url = optionalTrimmed(map.url());
        String key = optionalTrimmed(map.key());
        String dataUrl = optionalTrimmed(map.dataUrl());
        LandmarkMapSource source = map.source();

        boolean valid = switch (kind) {
            case asset -> filename != null && source == null && url == null && key == null && dataUrl == null;
            case embedded -> dataUrl != null && source == null && filename == null && url == null && key == null;
            case external -> url != null && source == null && filename == null && key == null && dataUrl == null;
            case stored -> key != null && source == null && filename == null && url == null && dataUrl == null;
            case buildings -> {
                if (source == LandmarkMapSource.asset) {
                    yield filename != null && url == null && key == null && dataUrl == null;
                }
                if (source == LandmarkMapSource.external) {
                    yield url != null && filename == null && key == null && dataUrl == null;
                }
                yield false;
            }
        };

        if (!valid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Objeto mapa invalido para kind/source");
        }
    }

    private void validatePosition(Double x, Double y, String fieldName) {
        if (x == null || y == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, fieldName + " requiere x e y");
        }
        if (x < 0 || x > 1 || y < 0 || y > 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, fieldName + " debe estar en rango [0,1]");
        }
    }

    private String requiredTrimmed(String value, String message) {
        if (value == null || value.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
        }
        return value.trim();
    }

    private String normalizedOrEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    private String optionalTrimmed(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private Integer normalizeMapRotationDegrees(Integer value) {
        int rotation = value == null ? 0 : value;
        if (rotation % 90 != 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "mapRotationDegrees debe ser multiplo de 90");
        }
        return Math.floorMod(rotation, 360);
    }

    private Double normalizeMapGridCellSize(Double value) {
        double cellSize = value == null ? 48.0 : value;
        if (cellSize < 8 || cellSize > 512) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "mapGridCellSize debe estar entre 8 y 512");
        }
        return Math.round(cellSize * 100.0) / 100.0;
    }

    private Double normalizeMapGridOffset(Double value) {
        double offset = value == null ? 0.0 : value;
        return Math.round(offset * 100.0) / 100.0;
    }

    private record IncludeOptions(boolean includeBuildings, boolean includeCharacters, boolean includeOrganizations) {

        private static IncludeOptions parse(String include) {
            if (include == null || include.trim().isEmpty()) {
                return new IncludeOptions(false, false, false);
            }

            Set<String> includeSet = new LinkedHashSet<>();
            for (String token : include.split(",")) {
                String normalized = token == null ? "" : token.trim().toLowerCase(Locale.ROOT);
                if (!normalized.isEmpty()) includeSet.add(normalized);
            }

            return new IncludeOptions(
                includeSet.contains("edificios") || includeSet.contains("buildings"),
                includeSet.contains("personajes") || includeSet.contains("characters"),
                includeSet.contains("organizaciones") || includeSet.contains("organizations")
            );
        }
    }
}
