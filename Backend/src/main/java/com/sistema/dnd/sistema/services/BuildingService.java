package com.sistema.dnd.sistema.services;

import com.sistema.dnd.sistema.dto.domain.BuildingDto;
import com.sistema.dnd.sistema.dto.domain.BuildingUpsertRequest;
import com.sistema.dnd.sistema.entity.BuildingEntity;
import com.sistema.dnd.sistema.entity.CharacterEntity;
import com.sistema.dnd.sistema.entity.LandmarkEntity;
import com.sistema.dnd.sistema.entity.OrganizationEntity;
import com.sistema.dnd.sistema.entity.TaggableEntityType;
import com.sistema.dnd.sistema.repository.BuildingRepository;
import com.sistema.dnd.sistema.repository.CharacterRepository;
import com.sistema.dnd.sistema.repository.LandmarkRepository;
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
    private final TaggingService taggingService;
    private final DomainMapper domainMapper;

    public BuildingService(
        BuildingRepository buildingRepository,
        LandmarkRepository landmarkRepository,
        CharacterRepository characterRepository,
        OrganizationRepository organizationRepository,
        TaggingService taggingService,
        DomainMapper domainMapper
    ) {
        this.buildingRepository = buildingRepository;
        this.landmarkRepository = landmarkRepository;
        this.characterRepository = characterRepository;
        this.organizationRepository = organizationRepository;
        this.taggingService = taggingService;
        this.domainMapper = domainMapper;
    }

    public List<BuildingDto> findAll() {
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
        syncTags(saved, request.tags());
        return domainMapper.toBuildingDto(saved);
    }

    @Transactional
    public BuildingDto update(Long id, BuildingUpsertRequest request) {
        BuildingEntity entity = buildingRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Edificio no encontrado"));

        applyUpsert(entity, request);
        BuildingEntity saved = buildingRepository.save(entity);
        syncTags(saved, request.tags());
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
        if (request.organizationId() != null) {
            organization = organizationRepository.findById(request.organizationId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "organizationId invalido"));
        }

        CharacterEntity owner = null;
        if (request.duenoId() != null) {
            owner = characterRepository.findById(request.duenoId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "duenoId invalido"));
        }

        entity.setLandmark(landmark);
        entity.setOrganization(organization);
        entity.setDueno(owner);
        entity.setNombre(requiredTrimmed(request.nombre(), "El nombre del edificio es obligatorio"));
        entity.setDescripcion(normalizedOrEmpty(request.descripcion()));
        entity.setMapBuildingIndex(request.mapBuildingIndex());

        if (request.posicion() == null) {
            entity.setPosicionX(null);
            entity.setPosicionY(null);
        } else {
            if (request.posicion().size() != 2) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "posicion debe tener [x,y]");
            }
            entity.setPosicionX(request.posicion().get(0));
            entity.setPosicionY(request.posicion().get(1));
        }
    }

    private void syncTags(BuildingEntity building, List<String> tags) {
        taggingService.replaceTags(TaggableEntityType.building, building.getId(), tags);
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

}
