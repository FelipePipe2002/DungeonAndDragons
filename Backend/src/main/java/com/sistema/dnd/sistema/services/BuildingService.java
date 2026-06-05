package com.sistema.dnd.sistema.services;

import com.sistema.dnd.sistema.dto.domain.BuildingDto;
import com.sistema.dnd.sistema.dto.domain.BuildingUpsertRequest;
import com.sistema.dnd.sistema.dto.domain.LandmarkMapRequest;
import com.sistema.dnd.sistema.entity.BuildingEntity;
import com.sistema.dnd.sistema.entity.CharacterEntity;
import com.sistema.dnd.sistema.entity.LandmarkEntity;
import com.sistema.dnd.sistema.entity.enums.LandmarkMapKind;
import com.sistema.dnd.sistema.entity.enums.LandmarkMapSource;
import com.sistema.dnd.sistema.entity.MediaAssetEntity;
import com.sistema.dnd.sistema.entity.enums.MediaAssetKind;
import com.sistema.dnd.sistema.entity.OrganizationEntity;
import com.sistema.dnd.sistema.entity.enums.TaggableEntityType;
import com.sistema.dnd.sistema.repository.BuildingRepository;
import com.sistema.dnd.sistema.repository.CharacterRepository;
import com.sistema.dnd.sistema.repository.LandmarkRepository;
import com.sistema.dnd.sistema.repository.MediaAssetRepository;
import com.sistema.dnd.sistema.repository.OrganizationRepository;
import jakarta.transaction.Transactional;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class BuildingService {

    private final BuildingRepository buildingRepository;
    private final LandmarkRepository landmarkRepository;
    private final CharacterRepository characterRepository;
    private final OrganizationRepository organizationRepository;
    private final MediaAssetRepository mediaAssetRepository;
    private final TaggingService taggingService;
    private final DomainMapper domainMapper;

    public BuildingService(
        BuildingRepository buildingRepository,
        LandmarkRepository landmarkRepository,
        CharacterRepository characterRepository,
        OrganizationRepository organizationRepository,
        MediaAssetRepository mediaAssetRepository,
        TaggingService taggingService,
        DomainMapper domainMapper
    ) {
        this.buildingRepository = buildingRepository;
        this.landmarkRepository = landmarkRepository;
        this.characterRepository = characterRepository;
        this.organizationRepository = organizationRepository;
        this.mediaAssetRepository = mediaAssetRepository;
        this.taggingService = taggingService;
        this.domainMapper = domainMapper;
    }

    public List<BuildingDto> findAll(Long landmarkId, Long organizationId) {
        if (landmarkId != null && landmarkId > 0 && organizationId != null && organizationId > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Solo puede filtrar por landmarkId o organizationId");
        }

        if (landmarkId != null && landmarkId > 0) {
            return buildingRepository.findByLandmarkIdOrderByNombreAsc(landmarkId)
                .stream()
                .map(domainMapper::toBuildingDto)
                .toList();
        }

        if (organizationId != null && organizationId > 0) {
            return buildingRepository.findByOrganizationIdOrderByNombreAsc(organizationId)
                .stream()
                .map(domainMapper::toBuildingDto)
                .toList();
        }

        return buildingRepository.findAll().stream().map(domainMapper::toBuildingDto).toList();
    }

    public BuildingDto findById(Long id) {
        BuildingEntity entity = buildingRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Edificio no encontrado"));
        return domainMapper.toBuildingDto(entity);
    }

    @Transactional
    public BuildingDto create(BuildingUpsertRequest request) {
        BuildingEntity entity = new BuildingEntity();
        applyUpsert(entity, request);
        BuildingEntity saved = buildingRepository.save(entity);
        syncChildren(saved, request);
        return domainMapper.toBuildingDto(saved);
    }

    @Transactional
    public BuildingDto update(Long id, BuildingUpsertRequest request) {
        BuildingEntity entity = buildingRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Edificio no encontrado"));

        applyUpsert(entity, request);
        BuildingEntity saved = buildingRepository.save(entity);
        syncChildren(saved, request);
        return domainMapper.toBuildingDto(saved);
    }

    @Transactional
    public void delete(Long id) {
        BuildingEntity entity = buildingRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Edificio no encontrado"));
        buildingRepository.delete(entity);
    }

    private void applyUpsert(BuildingEntity entity, BuildingUpsertRequest request) {
        LandmarkEntity landmark = null;
        if (request.landmarkId() != null && request.landmarkId() > 0) {
            landmark = landmarkRepository.findById(request.landmarkId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "landmarkId invalido"));
        }

        OrganizationEntity organization = null;
        if (request.organizationId() != null && request.organizationId() > 0) {
            organization = organizationRepository.findById(request.organizationId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "organizationId invalido"));
        }

        CharacterEntity owner = null;
        if (request.ownerId() != null && request.ownerId() > 0) {
            owner = characterRepository.findById(request.ownerId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "ownerId invalido"));
        }

        entity.setLandmark(landmark);
        entity.setOrganization(organization);
        entity.setDueno(owner);
        entity.setNombre(requiredTrimmed(request.name(), "El nombre del edificio es obligatorio"));
        entity.setDescripcion(normalizedOrEmpty(request.description()));
        entity.setMapBuildingIndex(request.mapBuildingIndex());
        entity.setMapRotationDegrees(normalizeMapRotationDegrees(request.mapRotationDegrees()));
        entity.setMapGridEnabled(Boolean.TRUE.equals(request.mapGridEnabled()));
        entity.setMapGridCellSize(normalizeMapGridCellSize(request.mapGridCellSize()));
        entity.setMapGridOffsetX(normalizeMapGridOffset(request.mapGridOffsetX()));
        entity.setMapGridOffsetY(normalizeMapGridOffset(request.mapGridOffsetY()));

        if (request.position() == null) {
            entity.setPosicionX(null);
            entity.setPosicionY(null);
        } else {
            if (request.position().size() != 2) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "posicion debe tener [x,y]");
            }
            entity.setPosicionX(request.position().get(0));
            entity.setPosicionY(request.position().get(1));
        }
    }

    private void syncChildren(BuildingEntity building, BuildingUpsertRequest request) {
        taggingService.replaceTags(TaggableEntityType.building, building.getId(), request.tags());

        Long mapAssetId = request.mapAssetId();
        if (mapAssetId != null && mapAssetId > 0) {
            building.setMapAsset(resolveMapAsset(mapAssetId));
        } else {
            building.setMapAsset(null);
        }

        if (building.getMapAsset() != null) {
            clearInlineMapRef(building);
            return;
        }

        if (request.map() != null) {
            LandmarkMapRequest map = request.map();
            validateMap(map);
            building.setMapKind(map.kind());
            building.setMapSource(map.source());
            building.setMapFilename(optionalTrimmed(map.filename()));
            building.setMapUrl(optionalTrimmed(map.url()));
            building.setMapStorageKey(optionalTrimmed(map.key()));
            building.setMapDataUrl(optionalTrimmed(map.dataUrl()));
            return;
        }

        clearInlineMapRef(building);
    }

    private void clearInlineMapRef(BuildingEntity building) {
        building.setMapKind(null);
        building.setMapSource(null);
        building.setMapFilename(null);
        building.setMapUrl(null);
        building.setMapStorageKey(null);
        building.setMapDataUrl(null);
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
            case buildings -> false;
        };

        if (!valid) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Objeto mapa invalido para building");
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
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private MediaAssetEntity resolveMapAsset(Long assetId) {
        MediaAssetEntity asset = mediaAssetRepository.findById(assetId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "mapAssetId invalido"));
        if (asset.getKind() != MediaAssetKind.image) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "mapAssetId del building debe ser de imagen");
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
}
