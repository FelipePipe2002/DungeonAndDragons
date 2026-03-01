package com.sistema.dnd.sistema.services;

import com.sistema.dnd.sistema.dto.domain.LandmarkDto;
import com.sistema.dnd.sistema.dto.domain.LandmarkEventRequest;
import com.sistema.dnd.sistema.dto.domain.LandmarkMapRequest;
import com.sistema.dnd.sistema.dto.domain.LandmarkUpsertRequest;
import com.sistema.dnd.sistema.entity.LandmarkEntity;
import com.sistema.dnd.sistema.entity.LandmarkEventEntity;
import com.sistema.dnd.sistema.entity.LandmarkMapKind;
import com.sistema.dnd.sistema.entity.LandmarkMapRefEntity;
import com.sistema.dnd.sistema.entity.LandmarkMapSource;
import com.sistema.dnd.sistema.entity.MediaAssetEntity;
import com.sistema.dnd.sistema.entity.MediaAssetKind;
import com.sistema.dnd.sistema.entity.TaggableEntityType;
import com.sistema.dnd.sistema.repository.LandmarkEventRepository;
import com.sistema.dnd.sistema.repository.LandmarkMapRefRepository;
import com.sistema.dnd.sistema.repository.LandmarkRepository;
import com.sistema.dnd.sistema.repository.MediaAssetRepository;
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
    private final LandmarkEventRepository landmarkEventRepository;
    private final LandmarkMapRefRepository landmarkMapRefRepository;
    private final MediaAssetRepository mediaAssetRepository;
    private final TaggingService taggingService;
    private final DomainMapper domainMapper;

    public LandmarkService(
        LandmarkRepository landmarkRepository,
        LandmarkEventRepository landmarkEventRepository,
        LandmarkMapRefRepository landmarkMapRefRepository,
        MediaAssetRepository mediaAssetRepository,
        TaggingService taggingService,
        DomainMapper domainMapper
    ) {
        this.landmarkRepository = landmarkRepository;
        this.landmarkEventRepository = landmarkEventRepository;
        this.landmarkMapRefRepository = landmarkMapRefRepository;
        this.mediaAssetRepository = mediaAssetRepository;
        this.taggingService = taggingService;
        this.domainMapper = domainMapper;
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
        LandmarkEntity entity = new LandmarkEntity();
        applyUpsert(entity, request);
        LandmarkEntity saved = landmarkRepository.save(entity);
        syncChildren(saved, request);
        return domainMapper.toLandmarkDto(saved, false, false, false);
    }

    @Transactional
    public LandmarkDto update(Long id, LandmarkUpsertRequest request) {
        LandmarkEntity entity = landmarkRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Landmark no encontrado"));

        applyUpsert(entity, request);
        LandmarkEntity saved = landmarkRepository.save(entity);
        syncChildren(saved, request);
        return domainMapper.toLandmarkDto(saved, false, false, false);
    }

    @Transactional
    public void delete(Long id) {
        LandmarkEntity entity = landmarkRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Landmark no encontrado"));
        landmarkRepository.delete(entity);
    }

    private void applyUpsert(LandmarkEntity entity, LandmarkUpsertRequest request) {
        entity.setIcono(normalizedOrEmpty(request.icono()));
        entity.setNombre(requiredTrimmed(request.nombre(), "El nombre del landmark es obligatorio"));
        entity.setTipo(request.tipo());
        entity.setEscalaIcono(request.escalaIcono());
        entity.setEscalaTexto(request.escalaTexto());
        entity.setMostrarLeyenda(request.mostrarLeyenda());
        entity.setPosicionX(request.posicion().get(0));
        entity.setPosicionY(request.posicion().get(1));
        entity.setPoblacion(request.poblacion());
        entity.setDescripcionCorta(optionalTrimmed(request.descripcionCorta()));
        entity.setHistoria(optionalTrimmed(request.historia()));
        entity.setMapRotationDegrees(normalizeMapRotationDegrees(request.mapRotationDegrees()));
        entity.setMapGridEnabled(Boolean.TRUE.equals(request.mapGridEnabled()));
        entity.setMapGridCellSize(normalizeMapGridCellSize(request.mapGridCellSize()));
        entity.setMapGridOffsetX(normalizeMapGridOffset(request.mapGridOffsetX()));
        entity.setMapGridOffsetY(normalizeMapGridOffset(request.mapGridOffsetY()));
    }

    private void syncChildren(LandmarkEntity landmark, LandmarkUpsertRequest request) {
        landmarkEventRepository.deleteByLandmarkId(landmark.getId());
        landmarkMapRefRepository.deleteByLandmarkId(landmark.getId());
        landmarkEventRepository.flush();
        landmarkMapRefRepository.flush();
        taggingService.replaceTags(TaggableEntityType.landmark, landmark.getId(), request.tags());

        Long mapAssetId = request.mapAssetId();
        if (mapAssetId != null && mapAssetId > 0) {
            landmark.setMapAsset(resolveMapAsset(mapAssetId));
        } else {
            landmark.setMapAsset(null);
        }

        for (LandmarkEventRequest event : request.eventos() == null ? List.<LandmarkEventRequest>of() : request.eventos()) {
            LandmarkEventEntity item = new LandmarkEventEntity();
            item.setLandmark(landmark);
            item.setNombre(requiredTrimmed(event.nombre(), "El nombre del evento es obligatorio"));
            item.setDescripcion(normalizedOrEmpty(event.descripcion()));
            item.setFecha(optionalTrimmed(event.fecha()));

            if (event.posicion() != null) {
                if (event.posicion().size() != 2) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La posicion del evento debe tener [x,y]");
                }
                Double x = event.posicion().get(0);
                Double y = event.posicion().get(1);
                validatePosition(x, y, "evento.posicion");
                item.setPosicionX(x);
                item.setPosicionY(y);
            }

            landmarkEventRepository.save(item);
        }

        if (landmark.getMapAsset() != null) {
            return;
        }

        if (request.mapa() != null) {
            LandmarkMapRequest map = request.mapa();
            validateMap(map);
            LandmarkMapRefEntity mapRef = new LandmarkMapRefEntity();
            mapRef.setLandmark(landmark);
            mapRef.setKind(map.kind());
            mapRef.setSource(map.source());
            mapRef.setFilename(optionalTrimmed(map.filename()));
            mapRef.setUrl(optionalTrimmed(map.url()));
            mapRef.setStorageKey(optionalTrimmed(map.key()));
            mapRef.setDataUrl(optionalTrimmed(map.dataUrl()));
            landmarkMapRefRepository.save(mapRef);
        }
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

    private MediaAssetEntity resolveMapAsset(Long assetId) {
        MediaAssetEntity asset = mediaAssetRepository.findById(assetId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "mapAssetId invalido"));
        if (asset.getKind() != MediaAssetKind.image && asset.getKind() != MediaAssetKind.json) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "mapAssetId debe apuntar a un asset de imagen o json");
        }
        return asset;
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
